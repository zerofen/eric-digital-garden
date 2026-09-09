'use client';

/* oxlint-disable jsx-a11y/media-has-caption */
import { usePathname } from 'next/navigation';
import { Pause, Play } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { SiteLink as Link } from '@/components/site-link';

export type MusicTrack = {
  title: string;
  artist: string;
  note?: string;
  url?: string;
  audio?: string;
};

type MusicContextValue = {
  tracks: MusicTrack[];
  currentIndex: number;
  currentTrack?: MusicTrack;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playerMessage: string;
  selectTrack: (index: number) => void;
  seekTo: (value: number) => void;
  togglePlayback: () => Promise<void>;
};

const MusicContext = createContext<MusicContextValue | null>(null);

export function formatMusicTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function musicProgressStyle(
  currentTime: number,
  duration: number,
): CSSProperties {
  const progress = duration
    ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
    : 0;
  return {
    '--music-progress': `${progress}%`,
  } as CSSProperties;
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic 必须在 MusicProvider 内使用。');
  return context;
}

export function useNativeMusicSeek(seekTo: (value: number) => void) {
  const seekRef = useRef(seekTo);
  const detachRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    seekRef.current = seekTo;
  }, [seekTo]);

  return useCallback((input: HTMLInputElement | null) => {
    detachRef.current?.();
    detachRef.current = null;
    if (!input) return;

    // 原生 input 事件会在鼠标或触屏拖动期间持续触发。回调 ref 还能在
    // 客户端恢复或替换节点时，把监听器准确地绑定到当前滑块。
    const handleInput = () => seekRef.current(Number(input.value));
    input.addEventListener('input', handleInput);
    detachRef.current = () => input.removeEventListener('input', handleInput);
  }, []);
}

export function MusicProvider({
  tracks,
  children,
}: {
  tracks: MusicTrack[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const playAfterTrackChange = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerMessage, setPlayerMessage] = useState('准备播放');
  const [hasInteracted, setHasInteracted] = useState(false);
  const currentTrack = tracks[currentIndex] ?? tracks[0];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audio) return;
    setCurrentTime(0);
    setDuration(0);
    setPlayerMessage('正在读取音频');
    audio.load();

    // 音频元素位于根布局，站内路由切换时不会被卸载。
    if (playAfterTrackChange.current) {
      playAfterTrackChange.current = false;
      void audio.play().catch(() => setPlayerMessage('点击播放继续收听'));
    }
  }, [currentIndex, currentTrack?.audio]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audio) return;
    setHasInteracted(true);
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlayerMessage('浏览器暂时无法播放这首歌');
      }
    } else {
      audio.pause();
    }
  }

  function selectTrack(index: number) {
    if (!tracks[index]?.audio) return;
    setHasInteracted(true);
    if (index === currentIndex) {
      void togglePlayback();
      return;
    }
    playAfterTrackChange.current = true;
    setCurrentIndex(index);
  }

  function playNextTrack() {
    const nextIndex = tracks.findIndex(
      (track, index) => index > currentIndex && track.audio,
    );
    const fallbackIndex = tracks.findIndex((track) => track.audio);
    const targetIndex = nextIndex >= 0 ? nextIndex : fallbackIndex;
    if (targetIndex < 0) return;
    playAfterTrackChange.current = true;
    setCurrentIndex(targetIndex);
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) return;
    const nextTime = Math.min(Math.max(value, 0), duration || 0);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const persistentSeekRef = useNativeMusicSeek(seekTo);

  const controls: MusicContextValue = {
    tracks,
    currentIndex,
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    playerMessage,
    selectTrack,
    seekTo,
    togglePlayback,
  };
  const showPersistentPlayer =
    hasInteracted && currentTrack && !pathname.startsWith('/music');

  return (
    <MusicContext.Provider value={controls}>
      {children}
      <audio
        className="music-audio-engine"
        ref={audioRef}
        src={currentTrack?.audio}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          setPlayerMessage(
            event.currentTarget.paused ? '准备播放' : '正在播放',
          );
        }}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onPlay={() => {
          setIsPlaying(true);
          setPlayerMessage('正在播放');
        }}
        onPause={() => {
          setIsPlaying(false);
          setPlayerMessage('已暂停');
        }}
        onEnded={playNextTrack}
        onError={() => setPlayerMessage('音频加载失败')}
      />
      {showPersistentPlayer && (
        <aside className="persistent-music-player" aria-label="正在播放的音乐">
          <span
            className={`persistent-equalizer ${isPlaying ? 'is-playing' : ''}`}
            aria-hidden="true"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <i key={index} />
            ))}
          </span>
          <Link className="persistent-track" href="/music/">
            <strong>{currentTrack.title}</strong>
            <small>{currentTrack.artist} · 返回音乐页</small>
          </Link>
          <button
            type="button"
            onClick={() => void togglePlayback()}
            aria-label={
              isPlaying
                ? `暂停 ${currentTrack.title}`
                : `播放 ${currentTrack.title}`
            }
          >
            {isPlaying ? (
              <Pause size={17} />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
          </button>
          <div className="persistent-progress">
            <input
              ref={persistentSeekRef}
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seekTo(Number(event.currentTarget.value))}
              aria-label={`${currentTrack.title} 播放进度`}
              aria-valuetext={`${formatMusicTime(currentTime)} / ${formatMusicTime(duration)}`}
              style={musicProgressStyle(currentTime, duration)}
            />
            <time>{formatMusicTime(currentTime)}</time>
          </div>
        </aside>
      )}
    </MusicContext.Provider>
  );
}
