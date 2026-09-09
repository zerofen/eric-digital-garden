import { ArrowUpRight } from 'lucide-react';
import { SiteLink as Link } from '@/components/site-link';
import { formatDate } from '@/lib/site';
import type { Post } from '@/lib/content.mjs';

export function PostList({ posts }: { posts: Post[] }) {
  if (!posts.length)
    return (
      <div className="empty-state">
        <span className="empty-symbol">✳</span>
        <h2>文字，正在酝酿</h2>
        <p>第一篇记录，会在准备好的时候和你见面。</p>
      </div>
    );
  return (
    <div className="post-list">
      {posts.map((post, index) => (
        <Link
          className="post-row"
          key={post.slug}
          href={`/posts/${post.slug}/`}
        >
          <span className="post-number">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="post-row-body">
            <div className="post-meta">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span className="meta-dot">·</span>
              <span>{post.tags[0] ?? '随笔'}</span>
              {post.example && <span className="example-label">示例</span>}
            </div>
            <h3>{post.title}</h3>
            <p>{post.description}</p>
          </div>
          <div className="post-row-end">
            <span>{post.readingMinutes} 分钟阅读</span>
            <ArrowUpRight size={22} strokeWidth={1.4} />
          </div>
        </Link>
      ))}
    </div>
  );
}
