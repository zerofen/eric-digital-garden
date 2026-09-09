import { ArrowDown, ArrowUpRight, Sprout, Asterisk } from 'lucide-react';
import { site } from '@/lib/site';
import { getPosts, getCollections } from '@/lib/content.mjs';
import { PostList } from '@/components/post-list';
import { Fragment } from 'react';
import type { Metadata } from 'next';
import { SiteLink as Link } from '@/components/site-link';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Home() {
  const posts = getPosts();
  const collections = getCollections();
  const stats = [
    { href: '/posts/', count: posts.length, label: '篇文章' },
    { href: '/projects/', count: collections.projects.length, label: '个项目' },
    { href: '/books/', count: collections.books.length, label: '本书' },
    { href: '/music/', count: collections.music.length, label: '首歌' },
  ];
  return (
    <main id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-content">
          <p className="eyebrow">
            <span className="status-dot" />
            {site.greeting}
            <span className="eyebrow-divider">/</span>
            <span>A DIGITAL GARDEN</span>
          </p>
          <h1 id="hero-title">
            {site.headline}
            <span className="title-period">.</span>
          </h1>
          <div className="avatar-garden">
            <span className="avatar-note">
              always
              <br />
              <i>growing</i>
              <span>⤵</span>
            </span>
            <Asterisk
              className="avatar-star"
              size={30}
              strokeWidth={1}
              aria-hidden="true"
            />
            <div className="avatar-ring">
              <img
                src={site.avatar}
                width="154"
                height="154"
                alt={site.avatarAlt}
                fetchPriority="high"
              />
            </div>
            <Sprout
              className="avatar-sprout"
              size={49}
              strokeWidth={1.15}
              aria-hidden="true"
            />
            <span className="avatar-caption">
              a little corner of the internet
            </span>
          </div>
          <div className="hero-copy">
            <p>{site.motto}</p>
            <span>{site.intro}</span>
          </div>
          <div className="hero-actions">
            <Link className="button button-primary" href="/posts/">
              去读文章
              <ArrowUpRight size={17} />
            </Link>
            <Link className="button button-secondary" href="/now/">
              看看此刻
              <span className="status-dot" />
            </Link>
          </div>
          <div className="hero-stats">
            {stats.map((item, index) => (
              <Fragment key={item.href}>
                {index > 0 && <Asterisk size={12} />}
                <Link href={item.href}>
                  <b>{String(item.count).padStart(2, '0')}</b>
                  {item.label}
                </Link>
              </Fragment>
            ))}
          </div>
        </div>
        <a className="scroll-hint" href="#latest">
          <span>往下逛逛</span>
          <ArrowDown size={16} />
        </a>
        <span className="hero-side-note">
          EST. {site.since} — A WORK IN PROGRESS
        </span>
      </section>
      <section id="latest" className="content-section latest-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FRESH FROM THE GARDEN</p>
            <h2>
              最近，写了这些<span>。</span>
            </h2>
          </div>
          <Link className="text-link" href="/posts/">
            所有文章 <ArrowUpRight size={17} />
          </Link>
        </div>
        <PostList posts={posts.slice(0, 3)} />
        <div className="garden-footnote">
          <Sprout size={19} strokeWidth={1.3} />
          <span>不急着抵达，享受生长的过程。</span>
        </div>
      </section>
    </main>
  );
}
