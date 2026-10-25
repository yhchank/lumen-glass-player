import { ListMusic, Trash2, X } from 'lucide-react';
import { GlassBadge } from '@ttqtt/liquid-glass-react';
import type { Track } from '../types';
import { cn, formatTime } from '../lib/format';
import { CoverArt } from './CoverArt';
import { WaveBars } from './WaveBars';

interface QueuePanelProps {
  tracks: Track[];
  currentTrack: Track | null;
  playing: boolean;
  onSelectTrack: (id: string) => void;
  onRemoveTrack: (id: string) => void;
  onClearQueue: () => void;
}

export function QueuePanel({
  tracks,
  currentTrack,
  playing,
  onSelectTrack,
  onRemoveTrack,
  onClearQueue,
}: QueuePanelProps) {
  const upcoming = tracks.filter((track) => track.id !== currentTrack?.id);
  const totalDuration = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  return (
    <aside className="queue-panel">
      <div className="queue-panel__inner">
        <div className="queue-head">
          <div>
            <div className="queue-head__eyebrow">
              <ListMusic size={13} strokeWidth={1.8} />
              播放队列
            </div>
            <div className="queue-head__title">
              <h2>接下来</h2>
              <GlassBadge
                count={tracks.length}
                max={999}
                tone="neutral"
                aria-label={`队列中有 ${tracks.length} 首歌曲`}
              />
            </div>
          </div>
          <button
            type="button"
            className="panel-icon-button"
            onClick={onClearQueue}
            disabled={!tracks.length}
            title="清空队列"
            aria-label="清空播放队列"
          >
            <Trash2 size={15} strokeWidth={1.7} />
          </button>
        </div>

        {currentTrack ? (
          <div className="queue-now">
            <div className="queue-now__art-wrap">
              <CoverArt track={currentTrack} variant="queue" className="queue-now__art" loading="eager" />
              <span className="queue-now__playing-indicator" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="queue-now__copy">
              <span className="queue-now__label">正在播放</span>
              <strong>{currentTrack.title}</strong>
              <span>{currentTrack.artist}</span>
            </div>
            <WaveBars
              playing={playing}
              bars={13}
              height={30}
              compact
              className="queue-now__wave"
            />
          </div>
        ) : null}

        <div className="queue-subhead">
          <span>待播放</span>
          <span>{upcoming.length} 首</span>
        </div>

        <div className="queue-scroll">
          {upcoming.length > 0 ? (
            upcoming.map((track, index) => (
              <div
                key={track.id}
                className={cn('queue-row', {
                  'is-current': track.id === currentTrack?.id,
                })}
              >
                <button
                  type="button"
                  className="queue-row__main"
                  onClick={() => onSelectTrack(track.id)}
                  title={`${track.title} — ${track.artist}`}
                >
                  <span className="queue-row__index">{String(index + 1).padStart(2, '0')}</span>
                  <CoverArt track={track} variant="row" className="queue-row__art" />
                  <span className="queue-row__copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist}</span>
                  </span>
                  <span className="queue-row__time">{formatTime(track.duration)}</span>
                </button>
                <button
                  type="button"
                  className="queue-row__remove"
                  onClick={() => onRemoveTrack(track.id)}
                  aria-label={`从队列移除 ${track.title}`}
                  title="从队列移除"
                >
                  <X size={13} strokeWidth={1.9} />
                </button>
              </div>
            ))
          ) : (
            <div className="queue-empty">
              <span className="queue-empty__orb">
                <ListMusic size={20} strokeWidth={1.4} />
              </span>
              <strong>{currentTrack ? '队列已播完' : '队列还是空的'}</strong>
              <p>
                {currentTrack
                  ? '从资料库添加歌曲，或导入新的音乐。'
                  : '导入音乐后会自动加入播放队列。'}
              </p>
            </div>
          )}
        </div>

        <div className="queue-foot">
          <span>{tracks.length} 首歌曲</span>
          <span>{formatTime(totalDuration, totalDuration >= 3600)}</span>
        </div>
      </div>
    </aside>
  );
}
