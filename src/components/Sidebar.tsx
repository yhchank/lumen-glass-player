import type { RefObject } from 'react';
import {
  AudioLines,
  Clock3,
  FolderPlus,
  Heart,
  Library,
  Plus,
  Radio,
  Sparkles,
} from 'lucide-react';
import { GlassButton, SearchField } from '@ttqtt/liquid-glass-react';
import type { LibraryView, Track } from '../types';
import { cn, formatTotalDuration } from '../lib/format';
import { CoverArt } from './CoverArt';

interface SidebarProps {
  tracks: Track[];
  recentTracks: Track[];
  view: LibraryView;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  favoritesCount: number;
  queueCount: number;
  importing: boolean;
  currentTrackId: string | null;
  onViewChange: (view: LibraryView) => void;
  onQueryChange: (query: string) => void;
  onImportFiles: () => void;
  onImportFolder: () => void;
  onSelectTrack: (id: string) => void;
}

const navigation: Array<{
  key: LibraryView;
  label: string;
  caption: string;
  icon: typeof AudioLines;
}> = [
  { key: 'now', label: '正在播放', caption: 'Now playing', icon: AudioLines },
  { key: 'library', label: '所有歌曲', caption: 'Library', icon: Library },
  { key: 'favorites', label: '我的收藏', caption: 'Favorites', icon: Heart },
];

export function Sidebar({
  tracks,
  recentTracks,
  view,
  query,
  searchRef,
  favoritesCount,
  queueCount,
  importing,
  currentTrackId,
  onViewChange,
  onQueryChange,
  onImportFiles,
  onImportFolder,
  onSelectTrack,
}: SidebarProps) {
  const totalDuration = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  return (
    <aside className="sidebar">
      <div className="sidebar__inner">
        <SearchField
          ref={searchRef}
          className="sidebar-search"
          aria-label="搜索歌曲、艺人或专辑"
          placeholder="搜索音乐"
          clearLabel="清空搜索"
          value={query}
          onValueChange={onQueryChange}
          radius={18}
          material="clear"
          size="small"
          backdropTone="dark"
        />

        <div className="sidebar__label">
          <span>浏览</span>
          <span className="sidebar__label-hint">{queueCount} 首待播</span>
        </div>

        <nav className="side-nav" aria-label="资料库导航">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = view === item.key && !query;
            const count =
              item.key === 'library'
                ? tracks.length
                : item.key === 'favorites'
                  ? favoritesCount
                  : undefined;
            return (
              <button
                key={item.key}
                type="button"
                className={cn('side-nav__item', { 'is-active': active })}
                onClick={() => onViewChange(item.key)}
              >
                <span className="side-nav__icon">
                  <Icon size={17} strokeWidth={1.7} />
                </span>
                <span className="side-nav__copy">
                  <span className="side-nav__label">{item.label}</span>
                  <span className="side-nav__caption">{item.caption}</span>
                </span>
                {count !== undefined && <span className="side-nav__count">{count}</span>}
                {active && <span className="side-nav__glow" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar__rule" />

        <div className="sidebar__label">
          <span>最近添加</span>
          <Clock3 size={13} strokeWidth={1.7} />
        </div>

        <div className="recent-list">
          {recentTracks.length > 0 ? (
            recentTracks.map((track) => (
              <button
                key={track.id}
                type="button"
                className={cn('recent-track', { 'is-current': currentTrackId === track.id })}
                onClick={() => onSelectTrack(track.id)}
                title={`${track.title} — ${track.artist}`}
              >
                <CoverArt track={track} variant="row" className="recent-track__art" />
                <span className="recent-track__copy">
                  <span className="recent-track__title">{track.title}</span>
                  <span className="recent-track__artist">{track.artist}</span>
                </span>
                {currentTrackId === track.id && (
                  <span className="mini-eq" aria-label="正在播放">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </button>
            ))
          ) : (
            <button type="button" className="recent-empty" onClick={onImportFiles}>
              <Radio size={16} strokeWidth={1.6} />
              <span>还没有音乐，先添加几首吧</span>
            </button>
          )}
        </div>

        <div className="sidebar__spacer" />

        <div className="library-summary">
          <div className="library-summary__top">
            <span className="library-summary__icon">
              <Sparkles size={14} strokeWidth={1.8} />
            </span>
            <span>你的声音空间</span>
          </div>
          <div className="library-summary__stats">
            <div>
              <strong>{tracks.length}</strong>
              <span>首歌曲</span>
            </div>
            <div>
              <strong>{formatTotalDuration(totalDuration)}</strong>
              <span>总时长</span>
            </div>
          </div>
          <div className="format-chips" aria-label="支持的音频格式">
            <span>FLAC</span>
            <span>WAV</span>
            <span>M4A</span>
            <span>MP3</span>
            <span>OGG</span>
            <span>OPUS</span>
          </div>
        </div>

        <div className="sidebar__actions">
          <GlassButton
            variant="glassProminent"
            controlSize="large"
            className="import-button"
            icon={<Plus size={17} strokeWidth={2} />}
            loading={importing}
            onClick={onImportFiles}
          >
            导入音乐
          </GlassButton>
          <button type="button" className="folder-button" onClick={onImportFolder}>
            <FolderPlus size={14} strokeWidth={1.7} />
            导入整个文件夹
          </button>
        </div>
      </div>
    </aside>
  );
}
