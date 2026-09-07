import fs from 'node:fs';
import path from 'node:path';

const [slug, title] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !title?.trim()) {
  console.error(
    '用法：npm run new-post -- my-first-post "我的第一篇文章"\n文件名请使用小写英文、数字和短横线。',
  );
  process.exit(1);
}
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const directory = path.resolve('content/posts');
fs.mkdirSync(directory, { recursive: true });
const filename = path.join(directory, `${slug}.md`);
try {
  // Exclusive creation protects an existing article from accidental overwrites.
  fs.writeFileSync(
    filename,
    `---\ntitle: ${JSON.stringify(title.trim())}\ndescription: "在这里写一两句文章摘要。"\ndate: "${date}"\ntags: ["随笔"]\ndraft: true\n---\n\n从这一行开始，写下你的想法。\n\n## 一个小标题\n\n慢慢来，先写下一小段。\n`,
    { flag: 'wx' },
  );
  console.log(`已创建草稿：${filename}\n发布前把 draft 改为 false。`);
} catch (error) {
  if (error.code === 'EEXIST')
    console.error(`文章已存在，没有覆盖：${filename}`);
  else console.error(error.message);
  process.exit(1);
}
