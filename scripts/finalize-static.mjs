import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist/client');
function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
}
// Directory indexes work on both Pages hosts without SPA fallbacks or Workers.
for (const file of walk(root).filter((file) => file.endsWith('.html'))) {
  if (['index.html', '404.html'].includes(path.basename(file))) continue;
  const destination = path.join(file.slice(0, -5), 'index.html');
  if (!destination.startsWith(root + path.sep))
    throw new Error('静态输出路径超出发布目录。');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(file, destination);
}
console.log('已将页面整理为可直接访问的目录索引。');
