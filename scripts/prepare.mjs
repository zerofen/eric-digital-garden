import fs from 'node:fs';
import { validateContent } from '../lib/content.mjs';

export function xml(value) {
  return String(value).replace(
    /[<>&"']/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[char],
  );
}

const { site, collections, posts: allPosts } = validateContent();
const posts = allPosts.filter((post) => !post.draft);
const origin = new URL(site.url).origin;
const routes = ['/', '/posts/', '/projects/', '/books/', '/music/', '/now/'];
const sitemap = [
  ...routes.map((route) => ({ path: route })),
  ...posts.map((post) => ({ path: `/posts/${post.slug}/`, date: post.date })),
];
fs.writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map((item) => `<url><loc>${xml(origin + item.path)}</loc>${item.date ? `<lastmod>${item.date}</lastmod>` : ''}</url>`).join('')}</urlset>\n`,
);
fs.writeFileSync(
  'public/feed.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(site.title)}</title><link>${xml(origin)}</link><description>${xml(site.description)}</description><language>zh-CN</language><atom:link href="${xml(origin)}/feed.xml" rel="self" type="application/rss+xml"/>${posts.map((post) => `<item><title>${xml(post.title)}</title><link>${xml(origin)}/posts/${post.slug}/</link><guid>${xml(origin)}/posts/${post.slug}/</guid><description>${xml(post.description)}</description><pubDate>${new Date(post.date).toUTCString()}</pubDate></item>`).join('')}</channel></rss>\n`,
);
fs.writeFileSync(
  'public/robots.txt',
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
);
fs.writeFileSync('public/CNAME', `${new URL(site.url).hostname}\n`);
console.log(
  `内容检查通过：${posts.length} 篇公开文章，${allPosts.length - posts.length} 篇草稿，${collections.moments.length} 条此刻。`,
);
