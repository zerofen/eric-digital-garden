'use client';

import { ArrowUpRight, Pause, Play, Radio } from 'lucide-react';
import {
  formatMusicTime,
  musicProgressStyle,
  useMusic,
  useNativeMusicSeek,
} from '@/components/music-provider';

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

export function MusicPlayer() {
  const {
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
  } = useMusic();
  const progressRef = useNativeMusicSeek(seekTo);

  if (!currentTrack) return null;

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
              <time>{formatMusicTime(currentTime)}</time>
              <input
                ref={progressRef}
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seekTo(Number(event.currentTarget.value))}
                aria-label={`${currentTrack.title} 播放进度`}
                aria-valuetext={`${formatMusicTime(currentTime)} / ${formatMusicTime(duration)}`}
                title="拖动滑块调整播放位置"
                style={musicProgressStyle(currentTime, duration)}
              />
              <time>{formatMusicTime(duration)}</time>
            </div>
          </div>
        </div>
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
