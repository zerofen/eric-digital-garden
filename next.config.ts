import type { NextConfig } from 'next';

// Pre-render all routes for GitHub Pages and Cloudflare Pages.
const nextConfig: NextConfig = {
  output: 'export',
  // 静态 RSC 文件与浏览器客户端必须使用同一个兼容性标识。
  deploymentId: 'eric-garden-static-v1',
  // vinext beta.5 redirects its prerender requests with trailingSlash enabled.
  // Export flat HTML first; finalize-static.mjs creates portable /path/index.html.
  trailingSlash: false,
  images: { unoptimized: true },
};

export default nextConfig;
