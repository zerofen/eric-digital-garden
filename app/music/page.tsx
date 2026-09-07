import type { Metadata } from 'next';
// Music is user-supplied; titles and artists are provided next to native controls.
/* oxlint-disable jsx-a11y/media-has-caption */
import { Music2, ArrowUpRight } from 'lucide-react';
import { CollectionPage, EmptyCollection } from '@/components/collection-page';
import { getCollections } from '@/lib/content.mjs';
export const metadata: Metadata = {
  title: '音乐',
  description: '为日常留一点旋律。',
  alternates: { canonical: '/music/' },
};
export default function Music() {
  const { music } = getCollections();
  return (
    <CollectionPage
      eyebrow="A SOUNDTRACK TO EVERYDAY LIFE"
      title="生活的背景音"
      description="有些心情，交给一首歌就好。"
    >
      {music.length ? (
        <div className="track-list">
          {music.map((track, i) => (
            <article className="track" key={`${track.title}-${i}`}>
              <span className="track-index">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="track-info">
                <h2>{track.title}</h2>
                <span>{track.artist}</span>
                {track.note && <p>{track.note}</p>}
                {track.audio && (
                  <audio
                    controls
                    preload="none"
                    src={track.audio}
                    aria-label={`${track.title}，${track.artist}`}
                  />
                )}
              </div>
              {track.url && (
                <a
                  className="text-link"
                  href={track.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`收听 ${track.title}`}
                >
                  去听听 <ArrowUpRight size={17} />
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyCollection
          symbol={<Music2 size={42} strokeWidth={1} />}
          title="下一首，正在路上"
          description="喜欢的旋律，值得慢慢收藏。"
        />
      )}
    </CollectionPage>
  );
}
