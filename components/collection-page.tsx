import type { ReactNode } from 'react';
import { SiteLink as Link } from '@/components/site-link';
export function CollectionPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className="inner-page">
      <header className="page-intro">
        <p className="eyebrow">{eyebrow}</p>
        <h1>
          {title}
          <span>。</span>
        </h1>
        <p>{description}</p>
      </header>
      {children}
    </main>
  );
}
export function EmptyCollection({
  symbol,
  title,
  description,
}: {
  symbol: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">{symbol}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="text-link" href="/posts/">
        先去文字里逛逛 ↗
      </Link>
    </div>
  );
}
