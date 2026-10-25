import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock3,
  Disc3,
  FileWarning,
  Heart,
  ListMusic,
  MoreHorizontal,
  Play,
  Plus,
  SearchX,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { GlassButton } from '@ttqtt/liquid-glass-react';
import type { SortKey, Track } from '../types';
import { cn, formatTime, pluralSongs } from '../lib/format';
import { CoverArt } from './CoverArt';

interface TrackTableProps {
  kicker: string;
  title: string;
  subtitle: string;
  tracks: Track[];
  currentTrackId: string | null;
  playing: boolean;
  favorites: Set<string>;
  missingPaths: Set<string>;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  emptyKind: 'library' | 'favorites' | 'search';
  canAddMusic: boolean;
  onSort: (key: SortKey) => void;
  onSelectTrack: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRemoveTrack: (id: string) => void;
  onPlayAll: () => void;
  onShuffleAll: () => void;
  onImport: () => void;
  onClearSearch: () => void;
}

function SortLabel({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      className={cn('table-sort', { 'is-active': active })}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <Icon size={11} strokeWidth={2} />
    </button>
  );
}

export function TrackTable({
  kicker,
  title,
  subtitle,
  tracks,
  currentTrackId,
  playing,
  favorites,
  missingPaths,
  sortKey,
  sortDirection,
  emptyKind,
  canAddMusic,
  onSort,
  onSelectTrack,
  onToggleFavorite,
  onRemoveTrack,
  onPlayAll,
  onShuffleAll,
  onImport,
  onClearSearch,
}: TrackTableProps) {
  const emptyCopy =
    emptyKind === 'favorites'
      ? {
          title: '还没有收藏的歌曲',
          body: '点一下歌曲右侧的心形图标，喜欢的声音会留在这里。',
          icon: Heart,
        }
      : emptyKind === 'search'
        ? {
            title: '没有找到匹配的音乐',
            body: '试试更短的歌名、艺人名，或清空搜索重新浏览。',
            icon: SearchX,
          }
        : {
            title: '音乐库还空着',
            body: '导入本地音频，封面、艺人、专辑与时长会自动整理。',
            icon: ListMusic,
          };

  const EmptyIcon = emptyCopy.icon;

  return (
    <section className="view-panel">
      <div className="view-head">
        <div className="view-head__copy">
          <span className="view-kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="view-head__actions">
          {tracks.length > 0 && (
            <>
              <GlassButton
                variant="glassProminent"
                controlSize="regular"
                icon={<Play size={15} fill="currentColor" />}
                onClick={onPlayAll}
              >
                播放全部
              </GlassButton>
              <GlassButton
                variant="glass"
                controlSize="regular"
                icon={<Shuffle size={15} />}
                onClick={onShuffleAll}
                aria-label="随机播放全部"
              >
                随机
              </GlassButton>
            </>
          )}
          {canAddMusic && (
            <GlassButton
              variant="glass"
              controlSize="regular"
              icon={<Plus size={15} />}
              onClick={onImport}
            >
              添加
            </GlassButton>
          )}
        </div>
      </div>

      <div className="table-card">
        <div className="table-head" role="row">
          <span className="table-head__index">#</span>
          <SortLabel
            label="歌曲"
            sortKey="title"
            activeKey={sortKey}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortLabel
            label="专辑"
            sortKey="album"
            activeKey={sortKey}
            direction={sortDirection}
            onSort={onSort}
          />
          <span className="table-head__static">音质</span>
          <SortLabel
            label="时长"
            sortKey="duration"
            activeKey={sortKey}
            direction={sortDirection}
            onSort={onSort}
          />
          <span className="table-head__actions" aria-hidden="true" />
        </div>

        <div className="table-body">
          {tracks.length > 0 ? (
            tracks.map((track, index) => {
              const isCurrent = track.id === currentTrackId;
              const isFavorite = favorites.has(track.id);
              const missing = missingPaths.has(track.path);
              return (
                <div
                  key={track.id}
                  className={cn('track-row', {
                    'is-current': isCurrent,
                    'is-missing': missing,
                  })}
                  onClick={() => onSelectTrack(track.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectTrack(track.id);
                    }
                  }}
                >
                  <span className="track-row__index">
                    {isCurrent && playing ? (
                      <span className="mini-eq is-playing" aria-label="正在播放">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      <>
                        <span className="track-row__number">{String(index + 1).padStart(2, '0')}</span>
                        <Play className="track-row__play" size={13} fill="currentColor" />
                      </>
                    )}
                  </span>

                  <span className="track-row__title-cell">
                    <CoverArt track={track} variant="row" className="track-row__art" />
                    <span className="track-row__copy">
                      <span className="track-row__title">
                        <span className="track-row__title-text">{track.title}</span>
                        {missing && (
                          <span className="missing-badge" title="文件已移动或删除">
                            <FileWarning size={12} />
                          </span>
                        )}
                      </span>
                      <span className="track-row__artist">
                        {track.artist}
                        <span className="row-dot" />
                        <span className="track-row__album-inline">{track.album}</span>
                        {track.year ? (
                          <>
                            <span className="row-dot track-row__album-inline-dot" />
                            <span>{track.year}</span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </span>

                  <span className="track-row__album" title={track.album}>
                    <span>{track.album}</span>
                    <small>{track.year || '—'}</small>
                  </span>

                  <span className="track-row__quality">
                    <span className="format-badge">{track.extension.toUpperCase()}</span>
                    <small>{track.lossless ? '无损' : track.quality || '音频'}</small>
                  </span>

                  <span className="track-row__duration">{formatTime(track.duration)}</span>

                  <span className="track-row__actions">
                    <button
                      type="button"
                      className={cn('row-action', { 'is-favorite': isFavorite })}
                      title={isFavorite ? '取消收藏' : '收藏'}
                      aria-label={isFavorite ? `取消收藏 ${track.title}` : `收藏 ${track.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite(track.id);
                      }}
                    >
                      <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      className="row-action row-action--danger"
                      title="从资料库移除"
                      aria-label={`从资料库移除 ${track.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveTrack(track.id);
                      }}
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="table-empty">
              <div className="table-empty__icon">
                <EmptyIcon size={28} strokeWidth={1.3} />
              </div>
              <h2>{emptyCopy.title}</h2>
              <p>{emptyCopy.body}</p>
              <div className="table-empty__actions">
                {emptyKind === 'library' && (
                  <GlassButton
                    variant="glassProminent"
                    controlSize="regular"
                    icon={<Plus size={15} />}
                    onClick={onImport}
                  >
                    导入音乐
                  </GlassButton>
                )}
                {emptyKind === 'search' && (
                  <GlassButton variant="glass" controlSize="regular" onClick={onClearSearch}>
                    清空搜索
                  </GlassButton>
                )}
                {emptyKind === 'favorites' && canAddMusic && (
                  <GlassButton
                    variant="glass"
                    controlSize="regular"
                    icon={<Disc3 size={15} />}
                    onClick={onImport}
                  >
                    导入音乐
                  </GlassButton>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="table-foot">
          <span>{pluralSongs(tracks.length)}</span>
          <span className="table-foot__hint">
            <Clock3 size={12} strokeWidth={1.7} />
            {formatTime(tracks.reduce((sum, track) => sum + (track.duration || 0), 0))} 总时长
          </span>
          <span className="table-foot__spacer" />
          <span className="table-foot__hint">
            <MoreHorizontal size={13} />
            单击歌曲即可播放
          </span>
        </div>
      </div>
    </section>
  );
}
