import {
  AudioLines,
  Clock3,
  Disc3,
  FolderOpen,
  HardDrive,
  Heart,
  Plus,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  GlassButton,
  GlassIconButton,
} from '@ttqtt/liquid-glass-react';
import type { Track } from '../types';
import {
  formatBitrate,
  formatBytes,
  formatSampleRate,
  formatTime,
  truncateMiddle,
} from '../lib/format';
import { CoverArt } from './CoverArt';
import { WaveBars } from './WaveBars';

interface NowPlayingProps {
  track: Track | null;
  playing: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  onImportFiles: () => void;
  onImportFolder: () => void;
  onShowInFolder: () => void;
}

export function NowPlaying({
  track,
  playing,
  favorite,
  onToggleFavorite,
  onImportFiles,
  onImportFolder,
  onShowInFolder,
}: NowPlayingProps) {
  if (!track) {
    return (
      <section className="hero-panel hero-panel--empty">
        <div className="empty-stage">
          <div className="empty-vinyl" aria-hidden="true">
            <div className="empty-vinyl__rings" />
            <div className="empty-vinyl__core">
              <Disc3 size={46} strokeWidth={1.05} />
            </div>
            <span className="empty-vinyl__shine" />
          </div>
          <div className="empty-copy">
            <span className="eyebrow">
              <Sparkles size={13} strokeWidth={1.8} />
              你的音乐，正在等待
            </span>
            <h1>让声音浮起来。</h1>
            <p>
              拖入本地音乐，或从文件夹导入。支持 MP3、M4A、AAC、WAV、FLAC、OGG
              与 Opus，封面与歌曲信息会自动读取。
            </p>
            <div className="empty-actions">
              <GlassButton
                variant="glassProminent"
                controlSize="large"
                icon={<Plus size={17} />}
                onClick={onImportFiles}
              >
                导入音乐
              </GlassButton>
              <GlassButton
                variant="glass"
                controlSize="large"
                icon={<FolderOpen size={17} />}
                onClick={onImportFolder}
              >
                选择文件夹
              </GlassButton>
            </div>
            <div className="empty-formats">
              <span>MP3</span>
              <span>M4A</span>
              <span>AAC</span>
              <span>WAV</span>
              <span>FLAC</span>
              <span>OGG</span>
              <span>OPUS</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="hero-panel">
      <div className="hero-layout">
        <div className="cover-stage">
          <div className="cover-stage__frame">
            <CoverArt track={track} variant="hero" loading="eager" />
            <span className="cover-stage__gleam" aria-hidden="true" />
          </div>
          <div className="cover-stage__topline">
            <span className="quality-pill">
              <span className="quality-pill__dot" />
              {track.lossless ? 'LOSSLESS' : 'HIGH QUALITY'}
            </span>
            <GlassIconButton
              aria-label={favorite ? '取消收藏' : '收藏这首歌曲'}
              className="favorite-fab"
              variant="glass"
              controlSize="small"
              material="clear"
              onClick={onToggleFavorite}
            >
              <Heart
                size={16}
                strokeWidth={1.9}
                fill={favorite ? 'currentColor' : 'none'}
              />
            </GlassIconButton>
          </div>
          <div className="cover-stage__caption">
            <span>{track.extension.toUpperCase()}</span>
            <span className="cover-stage__caption-rule" />
            <span>{track.lossless ? '无损音频' : '本地文件'}</span>
          </div>
        </div>

        <div className="track-story">
          <div className="now-state">
            <span className={playing ? 'now-state__eq is-playing' : 'now-state__eq'}>
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>{playing ? '正在播放' : '已暂停'}</span>
            <span className="now-state__divider" />
            <span className="now-state__caption">Now playing</span>
          </div>

          <div className="track-heading">
            <h1 className={track.title.length > 34 ? 'is-long' : undefined} title={track.title}>
              {track.title}
            </h1>
            <p className="track-artist">{track.artist}</p>
            <p className="track-album">
              <Disc3 size={13} strokeWidth={1.6} />
              <span>{track.album}</span>
              {track.year ? (
                <>
                  <span className="meta-dot" />
                  <span>{track.year}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="tag-row">
            {track.genre.slice(0, 2).map((genre) => (
              <span className="soft-tag" key={genre}>
                {genre}
              </span>
            ))}
            <span className="soft-tag soft-tag--accent">
              {track.lossless ? '无损' : track.quality || track.codec}
            </span>
            {track.sampleRate ? (
              <span className="soft-tag">{formatSampleRate(track.sampleRate)}</span>
            ) : null}
          </div>

          <div className="pulse-card">
            <div className="pulse-card__head">
              <span>
                <Waves size={14} strokeWidth={1.8} />
                声音律动
              </span>
              <span className="pulse-card__playing">
                {playing ? 'LIVE' : 'PAUSED'}
              </span>
            </div>
            <WaveBars
              playing={playing}
              bars={52}
              height={52}
              className="hero-wave"
            />
          </div>

          <div className="track-facts">
            <div className="track-fact">
              <span className="track-fact__icon">
                <AudioLines size={14} strokeWidth={1.8} />
              </span>
              <span className="track-fact__label">音质</span>
              <strong>{track.quality || formatBitrate(track.bitrate) || '—'}</strong>
            </div>
            <div className="track-fact">
              <span className="track-fact__icon">
                <Clock3 size={14} strokeWidth={1.8} />
              </span>
              <span className="track-fact__label">时长</span>
              <strong>{formatTime(track.duration)}</strong>
            </div>
            <div className="track-fact">
              <span className="track-fact__icon">
                <HardDrive size={14} strokeWidth={1.8} />
              </span>
              <span className="track-fact__label">文件</span>
              <strong>{formatBytes(track.size)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="track-path"
            title={truncateMiddle(track.path, 100)}
            onClick={onShowInFolder}
          >
            <FolderOpen size={13} strokeWidth={1.7} />
            <span>{track.fileName}</span>
            <span className="track-path__hint">在文件夹中显示</span>
          </button>
        </div>
      </div>
    </section>
  );
}
