import type { NextConfig } from 'next';

// Pre-render all routes for GitHub Pages and Cloudflare Pages.
const nextConfig: NextConfig = {
  output: 'export',
  // vinext beta.5 redirects its prerender requests with trailingSlash enabled.
  // Export flat HTML first; finalize-static.mjs creates portable /path/index.html.
  trailingSlash: false,
  images: { unoptimized: true },
};

export default nextConfig;
