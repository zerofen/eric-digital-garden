import type { Metadata } from 'next';
import { ArrowUpRight, Braces } from 'lucide-react';
import { CollectionPage, EmptyCollection } from '@/components/collection-page';
import { getCollections } from '@/lib/content.mjs';
export const metadata: Metadata = {
  title: '项目',
  description: '把好奇心变成可以触摸的小作品。',
  alternates: { canonical: '/projects/' },
};
export default function Projects() {
  const { projects } = getCollections();
  return (
    <CollectionPage
      eyebrow="MADE WITH CURIOSITY"
      title="想法，动手实现"
      description="从一个小念头开始，在实践里找到答案。"
    >
      {projects.length ? (
        <div className="collection-grid">
          {projects.map((item, i) => (
            <article className="collection-card" key={`${item.title}-${i}`}>
              <span className="card-index">
                {String(i + 1).padStart(2, '0')} / {item.status ?? '小小作品'}
              </span>
              <Braces size={36} strokeWidth={1.1} />
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <div className="card-tags">
                {item.tags?.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              {item.url && (
                <a
                  className="text-link"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  看看项目 <ArrowUpRight size={16} />
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyCollection
          symbol={<Braces size={42} strokeWidth={1} />}
          title="一些想法，还在发芽"
          description="第一件小作品完成后，会放在这里。"
        />
      )}
    </CollectionPage>
  );
}
