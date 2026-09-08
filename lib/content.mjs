import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const contentRoot = path.join(process.cwd(), 'content');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parsePost(source, slug) {
  // Restrict frontmatter to YAML; gray-matter also supports executable JS engines.
  if (!/^---\r?\n/.test(source))
    throw new Error('文章必须以 --- 换行开始的 YAML 信息块开头。');
  if (!slugPattern.test(slug))
    throw new Error(`文章文件名必须使用小写英文、数字和短横线：${slug}`);
  const { data, content } = matter(source);
  for (const key of ['title', 'description', 'date']) {
    if (typeof data[key] !== 'string' || !data[key].trim())
      throw new Error(`${slug} 缺少有效的 ${key}，日期请加引号。`);
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !Number.isFinite(Date.parse(data.date)) ||
    new Date(data.date).toISOString().slice(0, 10) !== data.date
  )
    throw new Error(`${slug} 日期必须为有效的 YYYY-MM-DD。`);
  if (
    data.tags !== undefined &&
    (!Array.isArray(data.tags) ||
      data.tags.some((tag) => typeof tag !== 'string' || !tag.trim()))
  )
    throw new Error(`${slug} 的 tags 必须为字符串数组。`);
  for (const key of ['draft', 'example'])
    if (data[key] !== undefined && typeof data[key] !== 'boolean')
      throw new Error(`${slug} 的 ${key} 必须为 true 或 false。`);
  if (!content.trim()) throw new Error(`${slug} 的正文不能为空。`);
  const headings = [];
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const title = sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {},
    });
    const id = `section-${headings.length + 1}`;
    headings.push({ id, text: title, depth });
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };
  // Markdown is rendered at build time and sanitized before reaching the browser.
  const html = sanitizeHtml(
    marked.parse(content, { renderer, async: false, gfm: true }),
    {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'del'],
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        h1: ['id'],
        h2: ['id'],
        h3: ['id'],
        h4: ['id'],
        h5: ['id'],
        h6: ['id'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        code: ['class'],
      },
      allowedSchemes: ['https', 'http', 'mailto'],
      transformTags: {
        img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
      },
    },
  );
  const characters = content.replace(/\s/g, '').length;
  return {
    slug,
    title: data.title.trim(),
    description: data.description.trim(),
    date: data.date,
    tags: data.tags ?? [],
    draft: data.draft ?? false,
    example: data.example ?? false,
    readingMinutes: Math.max(1, Math.ceil(characters / 450)),
    html,
    headings,
  };
}

export function getPosts({ includeDrafts = false } = {}) {
  const directory = path.join(contentRoot, 'posts');
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.md'))
    .map((file) =>
      parsePost(
        fs.readFileSync(path.join(directory, file), 'utf8'),
        file.slice(0, -3),
      ),
    )
    .filter((post) => includeDrafts || !post.draft)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
    );
}

export function getPost(slug) {
  return getPosts().find((post) => post.slug === slug);
}

export function getCollections() {
  return JSON.parse(
    fs.readFileSync(path.join(contentRoot, 'collections.json'), 'utf8'),
  );
}

export function getSite() {
  return JSON.parse(
    fs.readFileSync(path.join(contentRoot, 'site.json'), 'utf8'),
  );
}

export function validateContent() {
  const site = getSite();
  for (const field of [
    'name',
    'title',
    'description',
    'greeting',
    'headline',
    'motto',
    'intro',
    'avatar',
    'avatarAlt',
  ]) {
    if (typeof site[field] !== 'string' || !site[field].trim())
      throw new Error(`site.json 中的 ${field} 不能为空。`);
  }
  const url = new URL(site.url);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('site.url 必须是网站根地址，例如 https://eric.sryze.cc。');
  if (!Number.isInteger(site.since)) throw new Error('since 必须为年份数字。');
  if (site.avatar.startsWith('/')) {
    const publicRoot = path.resolve('public');
    const avatarPath = path.resolve(publicRoot, `.${site.avatar}`);
    if (
      !avatarPath.startsWith(publicRoot + path.sep) ||
      !fs.existsSync(avatarPath)
    )
      throw new Error(`找不到头像文件 public${site.avatar}。`);
  } else if (!site.avatar.startsWith('https://'))
    throw new Error('头像应使用 / 开头的本地路径或 HTTPS 地址。');
  const collections = getCollections();
  for (const key of ['projects', 'books', 'music', 'moments']) {
    if (!Array.isArray(collections[key]))
      throw new Error(`${key} 必须为数组。`);
    for (const item of collections[key]) {
      const fields =
        key === 'moments'
          ? ['date', 'text']
          : key === 'music'
            ? ['title', 'artist']
            : key === 'books'
              ? ['title', 'author']
              : ['title', 'description'];
      for (const field of fields)
        if (typeof item[field] !== 'string' || !item[field].trim())
          throw new Error(`${key} 的条目缺少 ${field}。`);
      for (const field of ['url', 'audio'])
        if (
          item[field] &&
          !/^https?:\/\//.test(item[field]) &&
          !/^\/(?!\/)/.test(item[field])
        )
          throw new Error(
            `${key}.${field} 请使用 HTTP(S) 链接或 / 开头的本地路径。`,
          );
      if (
        key === 'moments' &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
          !Number.isFinite(Date.parse(item.date)))
      )
        throw new Error('此刻日期须为 YYYY-MM-DD。');
    }
  }
  const posts = getPosts({ includeDrafts: true });
  return { site, collections, posts };
}
