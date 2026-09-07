import type { Metadata } from 'next';
import { getPosts } from '@/lib/content.mjs';
import { PostList } from '@/components/post-list';
export const metadata: Metadata = {
  title: '文章',
  description: '学习、生活和正在生长的想法。',
  alternates: { canonical: '/posts/' },
};

export default function Posts() {
  const posts = getPosts();
  return (
    <main id="main" className="inner-page">
      <header className="page-intro">
        <p className="eyebrow">THOUGHTS, NOTES & LITTLE THINGS</p>
        <h1>
          文字的花园<span>。</span>
        </h1>
        <p>学习的痕迹，生活的切片，还有一些未完成的想法。</p>
        <div className="page-count">
          {String(posts.length).padStart(2, '0')} 篇记录 <span>·</span>{' '}
          持续生长中
        </div>
      </header>
      <PostList posts={posts} />
    </main>
  );
}
