import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { getPosts, getPost } from '@/lib/content.mjs';
import { formatDate, site } from '@/lib/site';

export const dynamicParams = false;
export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return { title: '文章未找到' };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/posts/${post.slug}/` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      authors: [site.name],
      url: `${site.url}/posts/${post.slug}/`,
    },
  };
}

export default async function Article({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const posts = getPosts();
  const next = posts[posts.findIndex((item) => item.slug === post.slug) + 1];
  return (
    <main id="main" className="article-page">
      <Link className="back-link" href="/posts/">
        <ArrowLeft size={16} />
        返回文章
      </Link>
      <header className="article-header">
        <div className="post-meta">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>·</span>
          <span>{post.readingMinutes} 分钟阅读</span>
          {post.example && <span className="example-label">示例文章</span>}
        </div>
        <h1>{post.title}</h1>
        <p>{post.description}</p>
        <div className="article-author">
          <img src={site.avatar} alt="" width="30" height="30" />
          <span>{site.name}</span>
          <span className="author-divider" />
          {post.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </header>
      <div className="article-grid">
        <article
          className="prose"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
        {post.headings.length > 0 && (
          <aside className="article-toc">
            <p>这篇文章里</p>
            <nav aria-label="文章目录">
              {post.headings
                .filter((heading) => heading.depth <= 3)
                .map((heading) => (
                  <a
                    style={{ paddingLeft: heading.depth > 2 ? 12 : 0 }}
                    href={`#${heading.id}`}
                    key={heading.id}
                  >
                    {heading.text}
                  </a>
                ))}
            </nav>
          </aside>
        )}
      </div>
      <div className="article-ending">
        <span>✳</span>
        <p>感谢阅读，愿你也有所生长。</p>
      </div>
      {next && (
        <Link className="next-post" href={`/posts/${next.slug}/`}>
          <div>
            <span>再读一篇</span>
            <h2>{next.title}</h2>
          </div>
          <ArrowUpRight size={24} />
        </Link>
      )}
    </main>
  );
}
