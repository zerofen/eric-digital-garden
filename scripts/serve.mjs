import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const root = path.resolve('dist/client');
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.rsc': 'text/x-component; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};
if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('请先运行 npm run build。');
  process.exit(1);
}
const server = http.createServer((request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(request.url, `http://127.0.0.1:${port}`).pathname,
    );
    const acceptsRsc =
      request.headers.rsc === '1' ||
      request.headers.accept?.includes('text/x-component');
    const assetPathname = acceptsRsc
      ? pathname === '/'
        ? '/index.rsc'
        : `${pathname.replace(/\/$/, '')}.rsc`
      : pathname;
    let file = path.resolve(root, `.${assetPathname}`);
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, 'index.html');
    let status = 200;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      file = path.join(root, '404.html');
      status = 404;
    }
    const fileSize = fs.statSync(file).size;
    const range = status === 200 ? request.headers.range : undefined;
    let rangeStart = 0;
    let rangeEnd = fileSize - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        response.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        response.end();
        return;
      }
      if (!match[1]) {
        const suffixLength = Math.min(Number(match[2]), fileSize);
        rangeStart = fileSize - suffixLength;
      } else {
        rangeStart = Number(match[1]);
        if (match[2]) rangeEnd = Math.min(Number(match[2]), fileSize - 1);
      }
      if (
        !Number.isSafeInteger(rangeStart) ||
        !Number.isSafeInteger(rangeEnd) ||
        rangeStart < 0 ||
        rangeStart >= fileSize ||
        rangeEnd < rangeStart
      ) {
        response.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        response.end();
        return;
      }
      status = 206;
    }
    const contentLength = rangeEnd - rangeStart + 1;
    response.writeHead(status, {
      'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      ...(status === 206
        ? { 'Content-Range': `bytes ${rangeStart}-${rangeEnd}/${fileSize}` }
        : {}),
      ...(acceptsRsc
        ? {
            'X-Vinext-RSC-Compatibility-Id': 'eric-garden-static-v1',
          }
        : {}),
    });
    if (request.method === 'HEAD') response.end();
    else
      fs.createReadStream(file, { start: rangeStart, end: rangeEnd }).pipe(
        response,
      );
  } catch {
    response.writeHead(400);
    response.end('Bad request');
  }
});
server.on('error', (error) => {
  console.error(`预览服务无法启动：${error.message}`);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () =>
  console.log(`静态博客预览：http://127.0.0.1:${port}/`),
);
