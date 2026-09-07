import type { Metadata } from 'next';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { CollectionPage, EmptyCollection } from '@/components/collection-page';
import { getCollections } from '@/lib/content.mjs';
export const metadata: Metadata = {
  title: '书架',
  description: '在别人的文字里，看见更大的世界。',
  alternates: { canonical: '/books/' },
};
export default function Books() {
  const { books } = getCollections();
  return (
    <CollectionPage
      eyebrow="BETWEEN THE PAGES"
      title="纸页间的远方"
      description="读过的书，像走过的路，总会留下一点什么。"
    >
      {books.length ? (
        <div className="collection-grid">
          {books.map((book, i) => (
            <article
              className="collection-card book-card"
              key={`${book.title}-${i}`}
            >
              <span className="card-index">{book.status ?? '书架收藏'}</span>
              <BookOpen size={32} strokeWidth={1.1} />
              <h2>{book.title}</h2>
              <span className="book-author">{book.author}</span>
              {book.note && <p>{book.note}</p>}
              {book.url && (
                <a
                  className="text-link"
                  href={book.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  关于这本书 <ArrowUpRight size={16} />
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyCollection
          symbol={<BookOpen size={42} strokeWidth={1} />}
          title="书架，留着空位"
          description="下一本让人舍不得合上的书，会在这里留下记录。"
        />
      )}
    </CollectionPage>
  );
}
