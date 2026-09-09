'use client';

/* oxlint-disable jsx-a11y/media-has-caption */
import { ArrowUpRight, Pause, Play, Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type MusicTrack = {
  title: string;
  artist: string;
  note?: string;
  url?: string;
  audio?: string;
};

const dialLabels = [
  '88',
  '90.5',
  '93',
  '95.5',
  '98',
  '100.5',
  '103',
  '105.5',
  '108',
];
const dialTicks = Array.from({ length: 33 }, (_, index) => index);
const equalizerBars = Array.from({ length: 8 }, (_, index) => index);

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function MusicPlayer({ tracks }: { tracks: MusicTrack[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playAfterTrackChange = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerMessage, setPlayerMessage] = useState('准备播放');
  const currentTrack = tracks[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(0);
    setDuration(0);
    setPlayerMessage('正在读取音频');
    audio.load();

    // 切歌由用户点击触发，因此浏览器允许在新音源载入后继续播放。
    if (playAfterTrackChange.current) {
      playAfterTrackChange.current = false;
      void audio.play().catch(() => setPlayerMessage('点击播放继续收听'));
    }
  }, [currentIndex]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !currentTrack.audio) return;
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
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }

  return (
    <section className="music-station" aria-label="Eric 的音乐电台">
      <div className="station-console">
        <span className="station-tape" aria-hidden="true" />
        <div className="station-console-top">
          <span className={`on-air ${isPlaying ? 'is-live' : ''}`}>
            <i aria-hidden="true" />
            {isPlaying ? 'ON AIR' : 'STANDBY'}
          </span>
          <span className="station-name">
            ERIC&apos;S <b>MIDNIGHT RADIO</b> · 深夜电台
          </span>
        </div>

        <div className="station-dial" aria-hidden="true">
          <div className="station-ticks">
            {dialTicks.map((tick) => (
              <i key={tick} className={tick % 4 === 0 ? 'major' : ''} />
            ))}
          </div>
          <span className="tuner-marker" />
          <div className="station-dial-labels">
            {dialLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>

        <div className="station-now-playing">
          <button
            className="station-play"
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!currentTrack.audio}
            aria-label={
              isPlaying
                ? `暂停 ${currentTrack.title}`
                : `播放 ${currentTrack.title}`
            }
          >
            {isPlaying ? (
              <Pause size={22} />
            ) : (
              <Play size={22} fill="currentColor" />
            )}
          </button>

          <span
            className={`station-equalizer ${isPlaying ? 'is-playing' : ''}`}
            aria-hidden="true"
          >
            {equalizerBars.map((bar) => (
              <i key={bar} />
            ))}
          </span>

          <div className="station-track-detail">
            <p className="station-kicker">
              <Radio size={13} /> NOW PLAYING · {playerMessage}
            </p>
            <div className="station-track-title">
              <h2>{currentTrack.title}</h2>
              <span>{currentTrack.artist}</span>
            </div>
            {currentTrack.note && (
              <blockquote>「{currentTrack.note}」</blockquote>
            )}
            <div className="station-progress">
              <time>{formatTime(currentTime)}</time>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seekTo(Number(event.target.value))}
                aria-label={`${currentTrack.title} 播放进度`}
                style={
                  {
                    '--music-progress': `${duration ? (currentTime / duration) * 100 : 0}%`,
                  } as React.CSSProperties
                }
              />
              <time>{formatTime(duration)}</time>
            </div>
          </div>
        </div>

        <audio
          className="music-audio-engine"
          ref={audioRef}
          src={currentTrack.audio}
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
      </div>

      <div className="station-program-header">
        <div>
          <p>SEASON PLAYLIST</p>
          <h2>本季节目单</h2>
        </div>
        <span>{String(tracks.length).padStart(2, '0')} TRACKS</span>
      </div>

      <div className="station-program-list">
        {tracks.map((track, index) => {
          const active = index === currentIndex;
          return (
            <article
              className={`station-program ${active ? 'is-active' : ''}`}
              key={`${track.title}-${index}`}
            >
              <button
                type="button"
                className="station-program-select"
                onClick={() => selectTrack(index)}
                disabled={!track.audio}
                aria-pressed={active}
              >
                <span className="station-program-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="station-program-info">
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                  {track.note && <em>{track.note}</em>}
                </span>
                <span className="station-program-state">
                  <i aria-hidden="true" />
                  {active ? (isPlaying ? '播放中' : '已选中') : '播放'}
                </span>
              </button>
              {track.url && (
                <a
                  className="station-program-link"
                  href={track.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`在外部平台收听 ${track.title}`}
                >
                  <ArrowUpRight size={16} />
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
