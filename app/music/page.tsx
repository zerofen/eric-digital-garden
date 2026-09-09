import type { Metadata } from 'next';
import { Music2 } from 'lucide-react';
import { CollectionPage, EmptyCollection } from '@/components/collection-page';
import { MusicPlayer } from '@/components/music-player';
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
      eyebrow="MIDNIGHT RADIO · ERIC'S PICKS"
      title="音乐"
      description="按下播放，让周兴哲的旋律陪你走一程。"
    >
      {music.length ? (
        <MusicPlayer tracks={music} />
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
