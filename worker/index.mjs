const SESSION_COOKIE = 'eric_admin_session';
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_COLLECTION_ITEMS = 250;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLLECTION_KEYS = ['projects', 'books', 'music', 'moments'];
const COLLECTION_LABELS = {
  projects: '项目',
  books: '书架',
  music: '音乐',
  moments: '此刻',
};
const RSC_COMPATIBILITY_ID = 'eric-garden-static-v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isRscRequest(request) {
  return (
    ['GET', 'HEAD'].includes(request.method) &&
    (request.headers.get('RSC') === '1' ||
      request.headers.get('Accept')?.includes('text/x-component'))
  );
}

export function resolveAssetRequest(request) {
  if (!isRscRequest(request)) return request;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, '');
  url.pathname = pathname ? `${pathname}.rsc` : '/index.rsc';
  url.search = '';
  return new Request(url, request);
}

function parseByteRange(range, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range || '');
  if (!match || (!match[1] && !match[2]) || size < 1) return null;

  let start = 0;
  let end = size - 1;
  if (!match[1]) {
    const suffixLength = Math.min(Number(match[2]), size);
    start = size - suffixLength;
  } else {
    start = Number(match[1]);
    if (match[2]) end = Math.min(Number(match[2]), size - 1);
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    return null;
  return { start, end };
}

async function serveAudioRange(request, response) {
  const rangeHeader = request.headers.get('Range');
  if (
    request.method !== 'GET' ||
    !rangeHeader ||
    !response.ok ||
    response.status !== 200 ||
    !response.headers.get('Content-Type')?.startsWith('audio/')
  )
    return response;

  // Static Assets 当前会把音频区间请求返回为完整文件；Worker 在边缘把它
  // 切成标准 206 响应，浏览器才能在未完整下载时立即跳转播放位置。
  const source = await response.arrayBuffer();
  const selected = parseByteRange(rangeHeader, source.byteLength);
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  if (!selected) {
    headers.set('Content-Range', `bytes */${source.byteLength}`);
    headers.delete('Content-Length');
    return new Response(null, { status: 416, headers });
  }

  const body = source.slice(selected.start, selected.end + 1);
  headers.set(
    'Content-Range',
    `bytes ${selected.start}-${selected.end}/${source.byteLength}`,
  );
  headers.set('Content-Length', String(body.byteLength));
  return new Response(body, { status: 206, headers });
}

async function serveAsset(request, env) {
  const assetRequest = resolveAssetRequest(request);
  const response = await env.ASSETS.fetch(assetRequest);
  if (assetRequest === request || !response.ok)
    return serveAudioRange(request, response);

  // Vinext 通过 Content-Type 判断能否在当前文档内完成路由切换。
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/x-component; charset=utf-8');
  headers.set('X-Vinext-RSC-Compatibility-Id', RSC_COMPATIBILITY_ID);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function requestError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function apiHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  };
}

function json(payload, status = 200, headers = {}) {
  return Response.json(payload, {
    status,
    headers: { ...apiHeaders(), ...headers },
  });
}

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf('=');
        return index < 0
          ? [item, '']
          : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeGithubContent(value) {
  const bytes = encoder.encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function decodeGithubContent(value) {
  const binary = atob(value.replaceAll('\n', ''));
  return decoder.decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
  );
}

async function constantTimeTextEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1)
    difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

export async function createSessionToken(secret, now = Date.now()) {
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ expiresAt: now + SESSION_TTL_MS })),
  );
  const signature = bytesToBase64Url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

export async function verifySessionToken(secret, token, now = Date.now()) {
  if (!secret || !token) return false;
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra) return false;
  const expectedSignature = bytesToBase64Url(await hmac(secret, payload));
  if (!(await constantTimeTextEqual(expectedSignature, suppliedSignature)))
    return false;
  try {
    const data = JSON.parse(decoder.decode(base64UrlToBytes(payload)));
    return Number.isFinite(data.expiresAt) && data.expiresAt > now;
  } catch {
    return false;
  }
}

function frontmatterValue(frontmatter, name) {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) return '';
  return match[1].replace(/^(['"])(.*)\1$/, '$2').trim();
}

export function validatePostInput(slug, source) {
  if (!SLUG_PATTERN.test(slug || ''))
    throw requestError('文件名只能包含小写英文、数字和短横线。');
  if (typeof source !== 'string' || !source.trim())
    throw requestError('文章内容不能为空。');
  if (encoder.encode(source).length > MAX_SOURCE_BYTES)
    throw requestError('单篇文章不能超过 1 MB。', 413);
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
  if (!match) throw requestError('文章必须包含完整的 YAML 信息块和正文。');
  for (const name of ['title', 'description', 'date']) {
    if (!frontmatterValue(match[1], name))
      throw requestError(`文章缺少 ${name}。`);
  }
  const date = frontmatterValue(match[1], 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
    throw requestError('date 必须使用 YYYY-MM-DD 格式。');
  return true;
}

export function parsePostSummary(slug, source, sha) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = match?.[1] || '';
  return {
    slug,
    title: frontmatterValue(frontmatter, 'title') || slug,
    description: frontmatterValue(frontmatter, 'description'),
    date: frontmatterValue(frontmatter, 'date'),
    draft: frontmatterValue(frontmatter, 'draft') === 'true',
    sha,
  };
}

function collectionText(item, field, label, maxLength, required = false) {
  const value = item?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) throw requestError(`${label}不能为空。`);
    return '';
  }
  if (typeof value !== 'string') throw requestError(`${label}必须是文字。`);
  const trimmed = value.trim();
  if (required && !trimmed) throw requestError(`${label}不能为空。`);
  if (trimmed.length > maxLength)
    throw requestError(`${label}不能超过 ${maxLength} 个字符。`);
  return trimmed;
}

function collectionUrl(item, field, label) {
  const value = collectionText(item, field, label, 2048);
  if (!value) return '';
  if (!/^https?:\/\//.test(value) && !/^\/(?!\/)/.test(value))
    throw requestError(`${label}请使用 HTTP(S) 链接或 / 开头的站内路径。`);
  return value;
}

function optionalFields(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== ''));
}

export function validateCollectionItems(collection, items) {
  if (!COLLECTION_KEYS.includes(collection))
    throw requestError('找不到这个内容栏目。', 404);
  if (!Array.isArray(items)) throw requestError('栏目内容必须是数组。');
  if (items.length > MAX_COLLECTION_ITEMS)
    throw requestError(`每个栏目最多保存 ${MAX_COLLECTION_ITEMS} 条内容。`);

  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw requestError(`第 ${index + 1} 条内容格式不正确。`);

    if (collection === 'projects') {
      const tags = item.tags ?? [];
      if (
        !Array.isArray(tags) ||
        tags.length > 12 ||
        tags.some(
          (tag) =>
            typeof tag !== 'string' || !tag.trim() || tag.trim().length > 40,
        )
      )
        throw requestError('项目标签必须是最多 12 个非空文字标签。');
      return {
        title: collectionText(item, 'title', '项目名称', 120, true),
        description: collectionText(
          item,
          'description',
          '项目介绍',
          1200,
          true,
        ),
        ...optionalFields([
          ['status', collectionText(item, 'status', '项目状态', 80)],
          ['url', collectionUrl(item, 'url', '项目链接')],
        ]),
        ...(tags.length ? { tags: tags.map((tag) => tag.trim()) } : {}),
      };
    }

    if (collection === 'books') {
      return {
        title: collectionText(item, 'title', '书名', 160, true),
        author: collectionText(item, 'author', '作者', 120, true),
        ...optionalFields([
          ['note', collectionText(item, 'note', '读书笔记', 1600)],
          ['status', collectionText(item, 'status', '阅读状态', 80)],
          ['url', collectionUrl(item, 'url', '书籍链接')],
        ]),
      };
    }

    if (collection === 'music') {
      return {
        title: collectionText(item, 'title', '歌曲名', 160, true),
        artist: collectionText(item, 'artist', '歌手', 120, true),
        ...optionalFields([
          ['note', collectionText(item, 'note', '歌曲备注', 1600)],
          ['url', collectionUrl(item, 'url', '收听链接')],
          ['audio', collectionUrl(item, 'audio', '音频地址')],
        ]),
      };
    }

    const date = collectionText(item, 'date', '日期', 10, true);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw requestError('此刻日期必须是有效的 YYYY-MM-DD。');
    if (item.example !== undefined && typeof item.example !== 'boolean')
      throw requestError('示例标记必须是 true 或 false。');
    return {
      date,
      text: collectionText(item, 'text', '此刻内容', 3000, true),
      ...(item.example ? { example: true } : {}),
    };
  });
}

export function parseCollectionsSource(source) {
  if (
    typeof source !== 'string' ||
    encoder.encode(source).length > MAX_SOURCE_BYTES
  )
    throw requestError('栏目数据文件过大。', 413);
  let document;
  try {
    document = JSON.parse(source);
  } catch {
    throw requestError('栏目数据不是有效的 JSON。');
  }
  if (!document || typeof document !== 'object' || Array.isArray(document))
    throw requestError('栏目数据格式不正确。');
  return Object.fromEntries(
    COLLECTION_KEYS.map((key) => [
      key,
      validateCollectionItems(key, document[key]),
    ]),
  );
}

function githubPath(env, path) {
  const owner = encodeURIComponent(env.GITHUB_OWNER || '');
  const repository = encodeURIComponent(env.GITHUB_REPO || '');
  return `https://api.github.com/repos/${owner}/${repository}${path}`;
}

function assertConfiguration(env) {
  const missing = [
    'ADMIN_PASSWORD',
    'SESSION_SECRET',
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'GITHUB_REPO',
  ].filter((name) => !env[name]);
  if (missing.length) throw new Error(`服务端尚未配置：${missing.join(', ')}`);
}

async function githubRequest(env, path, init = {}) {
  const response = await fetch(githubPath(env, path), {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'eric-garden-admin',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.message || `GitHub 请求失败（${response.status}）`,
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

function repositoryBranch(env) {
  return env.GITHUB_BRANCH || 'main';
}

async function getPost(env, slug) {
  const path = `/contents/content/posts/${encodeURIComponent(slug)}.md?ref=${encodeURIComponent(repositoryBranch(env))}`;
  const file = await githubRequest(env, path);
  const content = decodeGithubContent(file.content);
  return { ...parsePostSummary(slug, content, file.sha), content };
}

async function listPosts(env) {
  const branch = encodeURIComponent(repositoryBranch(env));
  const entries = await githubRequest(
    env,
    `/contents/content/posts?ref=${branch}`,
  );
  const files = entries.filter(
    (entry) => entry.type === 'file' && entry.name.endsWith('.md'),
  );
  const posts = await Promise.all(
    files.map((file) => getPost(env, file.name.slice(0, -3))),
  );
  return posts.sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      left.slug.localeCompare(right.slug),
  );
}

async function getCollectionsFile(env) {
  const branch = encodeURIComponent(repositoryBranch(env));
  const file = await githubRequest(
    env,
    `/contents/content/collections.json?ref=${branch}`,
  );
  return {
    collections: parseCollectionsSource(decodeGithubContent(file.content)),
    sha: file.sha,
  };
}

async function saveCollection(env, collection, items, suppliedSha) {
  const current = await getCollectionsFile(env);
  if (!suppliedSha || suppliedSha !== current.sha)
    throw requestError('栏目内容已经更新，请刷新后台后再保存。', 409);
  const next = {
    ...current.collections,
    [collection]: validateCollectionItems(collection, items),
  };
  await githubRequest(env, '/contents/content/collections.json', {
    method: 'PUT',
    body: JSON.stringify({
      message: `更新${COLLECTION_LABELS[collection]}`,
      content: encodeGithubContent(`${JSON.stringify(next, null, 2)}\n`),
      branch: repositoryBranch(env),
      sha: current.sha,
    }),
  });
}

async function readJson(request) {
  const limit = MAX_SOURCE_BYTES + 20_000;
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > limit)
    throw requestError('请求内容过大。', 413);

  // Content-Length may be absent. Count bytes while streaming so an oversized
  // request is rejected before the whole body is held in Worker memory.
  const reader = request.body?.getReader();
  const chunks = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw requestError('请求内容过大。', 413);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = decoder.decode(body);
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw requestError('请求不是有效的 JSON。');
  }
}

function commitBody(env, slug, content, sha, action) {
  return {
    message: `${action}: ${slug}`,
    content: encodeGithubContent(content),
    branch: repositoryBranch(env),
    ...(sha ? { sha } : {}),
  };
}

async function savePost(env, slug, source, sha, action) {
  validatePostInput(slug, source);
  const path = `/contents/content/posts/${encodeURIComponent(slug)}.md`;
  return githubRequest(env, path, {
    method: 'PUT',
    body: JSON.stringify(commitBody(env, slug, source, sha, action)),
  });
}

function checkOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function isAuthenticated(request, env) {
  const token = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE];
  return verifySessionToken(env.SESSION_SECRET, token);
}

async function handleApi(request, env) {
  assertConfiguration(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const mutating = !['GET', 'HEAD'].includes(request.method);
  if (mutating && !checkOrigin(request))
    return json({ error: '请求来源无效。' }, 403);

  if (path === '/api/admin/login' && request.method === 'POST') {
    const body = await readJson(request);
    if (
      !(await constantTimeTextEqual(
        String(body.password || ''),
        env.ADMIN_PASSWORD,
      ))
    )
      return json({ error: '密码不正确。' }, 401);
    const token = await createSessionToken(env.SESSION_SECRET);
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    return json({ authenticated: true }, 200, {
      'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
    });
  }

  if (path === '/api/admin/logout' && request.method === 'POST') {
    return json({ authenticated: false }, 200, {
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    });
  }

  if (!(await isAuthenticated(request, env)))
    return json({ error: '请先登录。' }, 401);

  if (path === '/api/admin/posts' && request.method === 'GET') {
    return json({ posts: await listPosts(env) });
  }

  if (path === '/api/admin/collections' && request.method === 'GET') {
    return json(await getCollectionsFile(env));
  }

  const collectionMatch = path.match(
    /^\/api\/admin\/collections\/(projects|books|music|moments)$/,
  );
  if (collectionMatch && request.method === 'PUT') {
    const body = await readJson(request);
    await saveCollection(
      env,
      collectionMatch[1],
      body.items,
      String(body.sha || ''),
    );
    return json({ saved: true });
  }

  if (path === '/api/admin/posts' && request.method === 'POST') {
    const body = await readJson(request);
    const slug = String(body.slug || '');
    try {
      await getPost(env, slug);
      return json({ error: '这个文件名已经存在。' }, 409);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    await savePost(env, slug, String(body.content || ''), '', '新增文章');
    return json({ saved: true }, 201);
  }

  const match = path.match(/^\/api\/admin\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match) return json({ error: '找不到这个管理接口。' }, 404);
  const slug = match[1];

  if (request.method === 'GET') return json({ post: await getPost(env, slug) });

  if (request.method === 'PUT') {
    const body = await readJson(request);
    if (!body.sha)
      return json({ error: '缺少文章版本信息，请重新打开后再保存。' }, 409);
    await savePost(
      env,
      slug,
      String(body.content || ''),
      String(body.sha),
      '更新文章',
    );
    return json({ saved: true });
  }

  if (request.method === 'DELETE') {
    const body = await readJson(request);
    if (!body.sha)
      return json({ error: '缺少文章版本信息，请重新打开后再删除。' }, 409);
    const filePath = `/contents/content/posts/${encodeURIComponent(slug)}.md`;
    await githubRequest(env, filePath, {
      method: 'DELETE',
      body: JSON.stringify({
        message: `删除文章: ${slug}`,
        sha: String(body.sha),
        branch: repositoryBranch(env),
      }),
    });
    return json({ deleted: true });
  }

  return json({ error: '不支持这个请求方法。' }, 405);
}

const worker = {
  async fetch(request, env) {
    try {
      if (new URL(request.url).pathname.startsWith('/api/admin/'))
        return await handleApi(request, env);
      return serveAsset(request, env);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      const publicMessage =
        status < 500 ||
        String(error?.message || '').startsWith('服务端尚未配置：')
          ? error.message
          : '服务暂时不可用，请稍后重试。';
      return json({ error: publicMessage }, status);
    }
  },
};

export default worker;
