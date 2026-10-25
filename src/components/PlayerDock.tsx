import type { CSSProperties } from 'react';
import {
  Heart,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  GlassIconButton,
  GlassMenuButton,
  GlassSlider,
  GlassSurface,
} from '@ttqtt/liquid-glass-react';
import type { RepeatMode, Track } from '../types';
import { cn, formatTime } from '../lib/format';
import { CoverArt } from './CoverArt';

interface PlayerDockProps {
  track: Track | null;
  playing: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  rate: number;
  favorite: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onRateChange: (rate: number) => void;
  onToggleFavorite: () => void;
}

const rates = [
  { value: '0.75', label: '0.75×' },
  { value: '1', label: '1×' },
  { value: '1.25', label: '1.25×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
];

export function PlayerDock({
  track,
  playing,
  buffering,
  currentTime,
  duration,
  buffered,
  volume,
  muted,
  shuffle,
  repeat,
  rate,
  favorite,
  onToggle,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onRateChange,
  onToggleFavorite,
}: PlayerDockProps) {
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.45 ? Volume1 : Volume2;
  const SeekType = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <GlassSurface
      className="dock-panel"
      radius={28}
      refraction={24}
      material="clear"
      size="large"
      backdropTone="dark"
    >
      <div className="dock-inner">
        <div className="dock-track">
          <CoverArt track={track} variant="dock" className="dock-track__art" loading="eager" />
          <div className="dock-track__copy">
            <strong title={track?.title}>{track?.title || '未选择歌曲'}</strong>
            <span title={track?.artist}>{track?.artist || '从资料库中选择音乐'}</span>
          </div>
          {track && (
            <button
              type="button"
              className={cn('dock-favorite', { 'is-active': favorite })}
              onClick={onToggleFavorite}
              title={favorite ? '取消收藏' : '收藏'}
              aria-label={favorite ? '取消收藏' : '收藏'}
            >
              <Heart size={15} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.8} />
            </button>
          )}
        </div>

        <div className="dock-center">
          <div className="dock-controls">
            <button
              type="button"
              className={cn('dock-icon-button', { 'is-active': shuffle })}
              onClick={onToggleShuffle}
              title={shuffle ? '关闭随机播放' : '随机播放'}
              aria-label={shuffle ? '关闭随机播放' : '随机播放'}
              aria-pressed={shuffle}
            >
              <Shuffle size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="dock-icon-button"
              onClick={onPrevious}
              title="上一首"
              aria-label="上一首"
            >
              <SkipBack size={19} fill="currentColor" strokeWidth={1.4} />
            </button>
            <GlassIconButton
              aria-label={playing ? '暂停' : '播放'}
              className={cn('play-button', { 'is-loading': buffering })}
              variant="glassProminent"
              controlSize="large"
              onClick={onToggle}
            >
              {buffering && playing ? (
                <span className="play-spinner" aria-hidden="true" />
              ) : playing ? (
                <Pause size={20} fill="currentColor" strokeWidth={0} />
              ) : (
                <Play size={20} fill="currentColor" strokeWidth={0} className="play-glyph" />
              )}
            </GlassIconButton>
            <button
              type="button"
              className="dock-icon-button"
              onClick={onNext}
              title="下一首"
              aria-label="下一首"
            >
              <SkipForward size={19} fill="currentColor" strokeWidth={1.4} />
            </button>
            <button
              type="button"
              className={cn('dock-icon-button', { 'is-active': repeat !== 'off' })}
              onClick={onCycleRepeat}
              title={
                repeat === 'one' ? '单曲循环' : repeat === 'all' ? '列表循环' : '循环播放'
              }
              aria-label={
                repeat === 'one' ? '单曲循环，点击切换' : repeat === 'all' ? '列表循环，点击切换' : '循环播放，点击切换'
              }
              aria-pressed={repeat !== 'off'}
            >
              <SeekType size={16} strokeWidth={1.8} />
              {repeat === 'one' && <span className="dock-icon-button__dot" />}
            </button>
          </div>

          <div
            className="dock-seek"
            style={{ '--buffered': buffered } as CSSProperties}
          >
            <span className="dock-time">{formatTime(currentTime)}</span>
            <GlassSlider
              aria-label="播放进度"
              className="dock-seek__slider"
              value={Math.min(currentTime, duration || 0)}
              min={0}
              max={Math.max(duration, 0.1)}
              step={0.1}
              formatValue={(value) => `${formatTime(value)} / ${formatTime(duration)}`}
              onValueChange={onSeek}
              disabled={!track}
            />
            <span className="dock-time dock-time--right">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="dock-right">
          <GlassMenuButton
            kind="popUp"
            aria-label="播放速度"
            className="rate-button"
            controlSize="small"
            variant="glass"
            options={rates}
            value={String(rate)}
            onValueChange={(value) => onRateChange(Number(value))}
          />
          <div className="volume-control">
            <button
              type="button"
              className="dock-icon-button dock-icon-button--volume"
              onClick={onToggleMute}
              title={muted ? '取消静音' : '静音'}
              aria-label={muted ? '取消静音' : '静音'}
            >
              <VolumeIcon size={17} strokeWidth={1.8} />
            </button>
            <GlassSlider
              aria-label="音量"
              className="volume-slider"
              value={muted ? 0 : volume}
              min={0}
              max={1}
              step={0.01}
              formatValue={(value) => `${Math.round(value * 100)}%`}
              onValueChange={onVolumeChange}
            />
          </div>
        </div>
      </div>
    </GlassSurface>
  );
}
