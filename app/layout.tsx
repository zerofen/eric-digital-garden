import type { Metadata } from 'next';
import '@fontsource/dm-serif-display/latin-400.css';
import '@fontsource-variable/dm-sans';
import './globals.css';
import { site } from '@/lib/site';
import { getCollections } from '@/lib/content.mjs';
import { SiteHeader } from '@/components/site-header';
import { MusicProvider } from '@/components/music-provider';
import { SiteLink as Link } from '@/components/site-link';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s · ${site.name}` },
  description: site.description,
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { music } = getCollections();
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main">
          跳到正文
        </a>
        <MusicProvider tracks={music}>
          <SiteHeader />
          {children}
          <footer className="site-footer">
            <div>
              <Link className="footer-brand" href="/">
                {site.name}
                <span>.</span>
              </Link>
              <p>一方小天地，一些正在生长的想法。</p>
            </div>
            <div className="footer-meta">
              <span>
                © {site.since} {site.name}
              </span>
              <a href="/feed.xml">RSS 订阅 ↗</a>
              <a href={site.url}>{new URL(site.url).host}</a>
            </div>
          </footer>
        </MusicProvider>
      </body>
    </html>
  );
}
