const SESSION_COOKIE = 'eric_admin_session';
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_SOURCE_BYTES = 1024 * 1024;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
    header
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
    throw new Error('文件名只能包含小写英文、数字和短横线。');
  if (typeof source !== 'string' || !source.trim())
    throw new Error('文章内容不能为空。');
  if (encoder.encode(source).length > MAX_SOURCE_BYTES)
    throw new Error('单篇文章不能超过 1 MB。');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
  if (!match) throw new Error('文章必须包含完整的 YAML 信息块和正文。');
  for (const name of ['title', 'description', 'date']) {
    if (!frontmatterValue(match[1], name))
      throw new Error(`文章缺少 ${name}。`);
  }
  const date = frontmatterValue(match[1], 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
    throw new Error('date 必须使用 YYYY-MM-DD 格式。');
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

async function readJson(request) {
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_SOURCE_BYTES + 20_000)
    throw new Error('请求内容过大。');
  const text = await request.text();
  if (text.length > MAX_SOURCE_BYTES + 20_000)
    throw new Error('请求内容过大。');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('请求不是有效的 JSON。');
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

export default {
  async fetch(request, env) {
    try {
      if (new URL(request.url).pathname.startsWith('/api/admin/'))
        return await handleApi(request, env);
      return env.ASSETS.fetch(request);
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
