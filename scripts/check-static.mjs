import fs from 'node:fs';
import path from 'node:path';
import { getPosts, getSite } from '../lib/content.mjs';

const root = path.resolve('dist/client');
if (!fs.existsSync(path.join(root, 'index.html')))
  throw new Error('没有找到静态首页 dist/client/index.html。');
function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
}
const htmlFiles = walk(root).filter((file) => file.endsWith('.html'));
const errors = [];
const origin = new URL(getSite().url).origin;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  if (!/<html[^>]+lang="zh-CN"/.test(html))
    errors.push(`${file} 缺少中文语言标记。`);
  if (!/<title>[^<]+<\/title>/.test(html))
    errors.push(`${file} 缺少页面标题。`);
  if (!html.includes('id="main"')) errors.push(`${file} 缺少主内容。`);
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const href = match[1].replaceAll('&amp;', '&');
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const url = new URL(href, origin);
    const target = path.join(root, decodeURIComponent(url.pathname));
    if (!fs.existsSync(target) && !fs.existsSync(`${target}.html`))
      errors.push(`${path.relative(root, file)} 引用了不存在的资源：${href}`);
  }
}
for (const route of ['posts', 'projects', 'books', 'music', 'now']) {
  if (!fs.existsSync(path.join(root, route, 'index.html')))
    errors.push(`缺少路由 ${route}/index.html。`);
}
for (const post of getPosts({ includeDrafts: true })) {
  const exists = fs.existsSync(
    path.join(root, 'posts', post.slug, 'index.html'),
  );
  if (exists === post.draft)
    errors.push(
      post.draft
        ? `草稿 ${post.slug} 被错误公开。`
        : `文章 ${post.slug} 没有生成。`,
    );
}
for (const asset of [
  '404.html',
  'CNAME',
  '.nojekyll',
  'feed.xml',
  'sitemap.xml',
  'robots.txt',
])
  if (!fs.existsSync(path.join(root, asset)))
    errors.push(`缺少部署文件：${asset}`);
if (errors.length) throw new Error([...new Set(errors)].join('\n'));
console.log(
  `静态部署检查通过：${htmlFiles.length} 个 HTML 页面，所有内部页面链接和静态资源可用。输出目录：dist/client`,
);
