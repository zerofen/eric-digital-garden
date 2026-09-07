import type { Metadata } from 'next';
import { Sprout } from 'lucide-react';
import { CollectionPage, EmptyCollection } from '@/components/collection-page';
import { getCollections } from '@/lib/content.mjs';
import { formatDate, site } from '@/lib/site';
export const metadata: Metadata = {
  title: '此刻',
  description: '留住一些微小而真实的瞬间。',
  alternates: { canonical: '/now/' },
};
export default function Now() {
  const moments = getCollections().moments.toSorted((a, b) =>
    b.date.localeCompare(a.date),
  );
  return (
    <CollectionPage
      eyebrow="THE LITTLE THINGS, RIGHT NOW"
      title="此时，此地"
      description="一些不必写成长文，也值得被记住的瞬间。"
    >
      {moments.length ? (
        <div className="moments">
          {moments.map((moment, i) => (
            <article className="moment" key={`${moment.date}-${i}`}>
              <div className="moment-time">
                <span className="status-dot" />
                <time dateTime={moment.date}>{formatDate(moment.date)}</time>
              </div>
              <div className="moment-card">
                <div className="moment-author">
                  <img src={site.avatar} alt="" width="28" height="28" />
                  <span>{site.name}</span>
                  {moment.example && (
                    <span className="example-label">示例</span>
                  )}
                </div>
                <p>{moment.text}</p>
                <Sprout size={19} strokeWidth={1.2} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyCollection
          symbol={<Sprout size={42} strokeWidth={1} />}
          title="此刻，享受生活"
          description="下一个值得记住的瞬间，正在发生。"
        />
      )}
    </CollectionPage>
  );
}
