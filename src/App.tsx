import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  GlassBackdrop,
  GlassProvider,
  ToastProvider,
  useToast,
} from '@ttqtt/liquid-glass-react';
import type { GlassStrings } from '@ttqtt/liquid-glass-react';
import { FileAudio, LoaderCircle, Sparkles } from 'lucide-react';
import type {
  ImportResult,
  LibraryView,
  ScanProgress,
  SortKey,
  Track,
} from './types';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { BRAND_PALETTE } from './lib/theme';
import {
  cn,
  formatTotalDuration,
  trackSearchText,
} from './lib/format';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { NowPlaying } from './components/NowPlaying';
import { QueuePanel } from './components/QueuePanel';
import { TrackTable } from './components/TrackTable';
import { PlayerDock } from './components/PlayerDock';

const STORAGE_KEY = 'lumen.library.v1';

interface PersistedLibrary {
  library: Track[];
  queue: string[];
  currentId: string | null;
  favorites: string[];
  view: LibraryView;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
}

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== 'object') return false;
  const track = value as Partial<Track>;
  return (
    typeof track.id === 'string' &&
    typeof track.title === 'string' &&
    typeof track.streamUrl === 'string' &&
    typeof track.path === 'string'
  );
}

function loadLibrary(): PersistedLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedLibrary>;
      const library = Array.isArray(parsed.library) ? parsed.library.filter(isTrack) : [];
      const ids = new Set(library.map((track) => track.id));
      const queue = Array.isArray(parsed.queue)
        ? parsed.queue.filter((id): id is string => typeof id === 'string' && ids.has(id))
        : [];
      const favorites = Array.isArray(parsed.favorites)
        ? parsed.favorites.filter((id): id is string => typeof id === 'string' && ids.has(id))
        : [];
      const initialCurrent =
        parsed.currentId && ids.has(parsed.currentId)
          ? parsed.currentId
          : queue[0] || library[0]?.id || null;
      return {
        library,
        queue: queue.length ? queue : library.map((track) => track.id),
        currentId: initialCurrent,
        favorites,
        view:
          parsed.view === 'library' || parsed.view === 'favorites' || parsed.view === 'now'
            ? parsed.view
            : 'now',
        sortKey:
          parsed.sortKey === 'title' ||
          parsed.sortKey === 'artist' ||
          parsed.sortKey === 'album' ||
          parsed.sortKey === 'duration'
            ? parsed.sortKey
            : 'added',
        sortDirection: parsed.sortDirection === 'asc' ? 'asc' : 'desc',
      };
    }
  } catch {
    // Storage belongs to a previous version or was interrupted. Start clean.
  }
  return {
    library: [],
    queue: [],
    currentId: null,
    favorites: [],
    view: 'now',
    sortKey: 'added',
    sortDirection: 'desc',
  };
}

const glassStrings: Partial<GlassStrings> = {
  close: '关闭',
  cancel: '取消',
  decrease: '减少',
  increase: '增加',
  clearSearch: '清空搜索',
  searchCommands: '搜索命令',
  noResults: '没有结果',
  back: '返回',
  resizeSidebar: '调整侧栏宽度',
  morePathLevels: '更多路径',
  moreToolbarItems: '更多操作',
};

function sortTracks(
  tracks: Track[],
  key: SortKey,
  direction: 'asc' | 'desc',
): Track[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
  return [...tracks].sort((a, b) => {
    let result = 0;
    if (key === 'title') result = collator.compare(a.title, b.title);
    else if (key === 'artist') result = collator.compare(a.artist, b.artist);
    else if (key === 'album') result = collator.compare(a.album, b.album);
    else if (key === 'duration') result = a.duration - b.duration;
    else result = a.addedAt - b.addedAt;
    if (result === 0) return collator.compare(a.title, b.title);
    return result * multiplier;
  });
}

function LumenApp() {
  const initial = useRef(loadLibrary());
  const toast = useToast();
  const [library, setLibrary] = useState<Track[]>(initial.current.library);
  const [queue, setQueue] = useState<string[]>(initial.current.queue);
  const [currentId, setCurrentId] = useState<string | null>(initial.current.currentId);
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(initial.current.favorites),
  );
  const [view, setView] = useState<LibraryView>(initial.current.view);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(initial.current.sortKey);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    initial.current.sortDirection,
  );
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [dragging, setDragging] = useState(false);
  const [missingPaths, setMissingPaths] = useState<Set<string>>(new Set());
  const dragDepth = useRef(0);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef(library);
  const queueRef = useRef(queue);
  const currentIdRef = useRef(currentId);
  const importBusyRef = useRef(false);

  useEffect(() => {
    libraryRef.current = library;
    queueRef.current = queue;
    currentIdRef.current = currentId;
  }, [library, queue, currentId]);

  const notifyError = useCallback(
    (message: string) => toast({ message, tone: 'error', duration: 4200 }),
    [toast],
  );

  const player = useAudioPlayer({
    tracks: library,
    queue,
    currentId,
    onCurrentIdChange: setCurrentId,
    onError: notifyError,
  });

  const currentTrack = player.currentTrack;
  const palette = BRAND_PALETTE;
  const favorite = Boolean(currentTrack && favorites.has(currentTrack.id));

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            library,
            queue,
            currentId,
            favorites: [...favorites],
            view,
            sortKey,
            sortDirection,
          }),
        );
      } catch {
        // A huge library can fill localStorage; the session still works.
      }
    }, 320);
    return () => window.clearTimeout(id);
  }, [library, queue, currentId, favorites, view, sortKey, sortDirection]);

  useEffect(() => {
    if (!window.lumen) return;
    return window.lumen.onScanProgress((progress) => {
      setScanProgress(progress.active ? progress : null);
    });
  }, []);

  useEffect(() => {
    if (!window.lumen || !library.length) {
      setMissingPaths(new Set());
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void window.lumen
        .verifyPaths(library.map((track) => track.path))
        .then((result) => {
          if (cancelled) return;
          const missing = new Set(
            Object.entries(result)
              .filter(([, exists]) => !exists)
              .map(([path]) => path),
          );
          setMissingPaths(missing);
        })
        .catch(() => {});
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [library]);

  useEffect(() => {
    if (!currentTrack) {
      document.title = '流光 Lumen';
      return;
    }
    document.title = `${currentTrack.title} · ${currentTrack.artist} — 流光 Lumen`;
  }, [currentTrack]);

  const addTracks = useCallback(
    (incoming: Track[]) => {
      if (!incoming.length) return { added: 0, refreshed: 0 };
      const incomingMap = new Map(incoming.map((track) => [track.id, track]));
      const existingMap = new Map(libraryRef.current.map((track) => [track.id, track]));
      const fresh = incoming.filter((track) => !existingMap.has(track.id));
      const refreshed = incoming.filter((track) => existingMap.has(track.id));

      if (refreshed.length) {
        setLibrary((previous) =>
          previous.map((track) => {
            const updated = incomingMap.get(track.id);
            return updated ? { ...updated, addedAt: track.addedAt } : track;
          }),
        );
      }

      if (fresh.length) {
        setLibrary((previous) => {
          const known = new Set(previous.map((track) => track.id));
          return [...previous, ...fresh.filter((track) => !known.has(track.id))];
        });
        setQueue((previous) => {
          const known = new Set(previous);
          return [...previous, ...fresh.filter((track) => !known.has(track.id)).map((track) => track.id)];
        });
        if (!currentIdRef.current) {
          setCurrentId(fresh[0].id);
        }
      }

      return { added: fresh.length, refreshed: refreshed.length };
    },
    [],
  );

  const runImport = useCallback(
    async (operation: () => Promise<ImportResult>, sourceLabel: string) => {
      if (importBusyRef.current) return;
      importBusyRef.current = true;
      try {
        const result = await operation();
        if (result.cancelled) return;
        if (!result.tracks.length) {
          toast({
            message:
              result.failed > 0
                ? `读取失败，${result.failed} 个文件无法解析。`
                : '没有找到可播放的音频文件。',
            tone: 'warning',
            duration: 3600,
          });
          return;
        }
        const { added, refreshed } = addTracks(result.tracks);
        if (added > 0) {
          toast({
            message:
              result.failed > 0
                ? `已导入 ${added} 首歌曲，${result.failed} 个文件读取失败。`
                : `${sourceLabel}导入完成 · ${added} 首歌曲`,
            tone: 'success',
            duration: 3200,
          });
        } else if (refreshed > 0) {
          toast({ message: '资料库已是最新，已刷新歌曲信息。', tone: 'neutral' });
        } else {
          toast({ message: '这些歌曲已经在资料库中了。', tone: 'neutral' });
        }
      } catch {
        toast({
          message: '导入时出了点问题，请确认文件仍然可访问。',
          tone: 'error',
          duration: 4200,
        });
      } finally {
        importBusyRef.current = false;
        setScanProgress(null);
      }
    },
    [addTracks, toast],
  );

  const importFiles = useCallback(() => {
    if (!window.lumen) return;
    void runImport(() => window.lumen.pickFiles(), '音乐');
  }, [runImport]);

  const importFolder = useCallback(() => {
    if (!window.lumen) return;
    void runImport(() => window.lumen.pickFolder(), '文件夹');
  }, [runImport]);

  const importPaths = useCallback(
    (paths: string[]) => {
      if (!window.lumen || !paths.length) return;
      void runImport(() => window.lumen.importPaths(paths), '文件');
    },
    [runImport],
  );

  useEffect(() => {
    if (!window.lumen) return;
    void window.lumen.consumeLaunchPaths().then((paths) => {
      if (paths.length) importPaths(paths);
    });
    return window.lumen.onOpenFiles((paths) => importPaths(paths));
  }, [importPaths]);

  useEffect(() => {
    if (!window.lumen) return;
    return window.lumen.onMediaCommand((command) => {
      if (command === 'toggle') player.toggle();
      else if (command === 'next') player.next();
      else if (command === 'previous') player.previous();
    });
  }, [player]);

  const ensureQueued = useCallback((id: string) => {
    if (!queueRef.current.includes(id)) {
      setQueue((previous) => [...previous, id]);
    }
  }, []);

  const selectTrack = useCallback(
    (id: string) => {
      ensureQueued(id);
      player.selectTrack(id);
    },
    [ensureQueued, player],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((previous) => {
        const next = new Set(previous);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [],
  );

  const removeTrack = useCallback(
    (id: string) => {
      const index = libraryRef.current.findIndex((track) => track.id === id);
      if (index < 0) return;
      const removed = libraryRef.current[index];
      const wasCurrent = currentIdRef.current === id;
      const remainingQueue = queueRef.current.filter((entry) => entry !== id);
      const nextId = remainingQueue[0] || null;
      const wasPlaying = player.isPlaying;

      setLibrary((previous) => previous.filter((track) => track.id !== id));
      setQueue(remainingQueue);
      setFavorites((previous) => {
        if (!previous.has(id)) return previous;
        const next = new Set(previous);
        next.delete(id);
        return next;
      });

      if (wasCurrent && nextId) {
        setCurrentId(nextId);
        if (wasPlaying) player.selectTrack(nextId, true);
      }
      if (wasCurrent && !nextId) setCurrentId(null);

      toast({
        message: `已从资料库移除《${removed.title}》`,
        tone: 'neutral',
        duration: 5000,
        action: {
          label: '撤销',
          onSelect: () => {
            setLibrary((previous) => {
              if (previous.some((track) => track.id === id)) return previous;
              const copy = [...previous];
              copy.splice(Math.min(index, copy.length), 0, removed);
              return copy;
            });
            setQueue((previous) => (previous.includes(id) ? previous : [...previous, id]));
          },
        },
      });
    },
    [player, toast],
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((previous) => previous.filter((entry) => entry !== id));
  }, []);

  const clearQueue = useCallback(() => {
    const previousQueue = queueRef.current;
    if (!previousQueue.length) return;
    setQueue([]);
    toast({
      message: '已清空播放队列',
      tone: 'neutral',
      duration: 5000,
      action: {
        label: '撤销',
        onSelect: () => setQueue(previousQueue),
      },
    });
  }, [toast]);

  const sortedAllTracks = useMemo(
    () => sortTracks(library, sortKey, sortDirection),
    [library, sortKey, sortDirection],
  );

  const visibleTracks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
    let source = sortedAllTracks;
    if (view === 'favorites' && !normalizedQuery) {
      source = source.filter((track) => favorites.has(track.id));
    }
    if (normalizedQuery) {
      source = source.filter((track) => trackSearchText(track).includes(normalizedQuery));
    }
    return source;
  }, [sortedAllTracks, view, favorites, query]);

  const searchResults = query.trim().length > 0;

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((previousKey) => {
      if (previousKey === key) {
        setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
        return previousKey;
      }
      setSortDirection(key === 'title' || key === 'artist' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const playAll = useCallback(
    (tracks: Track[]) => {
      if (!tracks.length) return;
      const ids = tracks.map((track) => track.id);
      setQueue(ids);
      player.selectTrack(ids[0], true);
    },
    [player],
  );

  const shuffleAll = useCallback(
    (tracks: Track[]) => {
      if (!tracks.length) return;
      const ids = tracks.map((track) => track.id);
      for (let index = ids.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        [ids[index], ids[target]] = [ids[target], ids[index]];
      }
      setQueue(ids);
      player.selectTrack(ids[0], true);
    },
    [player],
  );

  const showInFolder = useCallback(() => {
    if (currentTrack) void window.lumen?.showItemInFolder(currentTrack.path);
  }, [currentTrack]);

  const handleViewChange = useCallback((nextView: LibraryView) => {
    setView(nextView);
    setQuery('');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const editing =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target?.isContentEditable;
      const interactive =
        editing ||
        tagName === 'BUTTON' ||
        tagName === 'A' ||
        Boolean(target?.closest('button, a, [role="button"], [role="slider"]'));

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        importFiles();
        return;
      }
      if (event.key === 'Escape') {
        if (query) setQuery('');
        else searchRef.current?.blur();
        return;
      }
      if (interactive) return;

      if (event.code === 'Space') {
        event.preventDefault();
        player.toggle();
      } else if (event.key === 'ArrowRight' && event.shiftKey) {
        event.preventDefault();
        player.setVolume(player.volume + 0.05);
      } else if (event.key === 'ArrowLeft' && event.shiftKey) {
        event.preventDefault();
        player.setVolume(player.volume - 0.05);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        player.seek(player.currentTime + 5);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        player.seek(player.currentTime - 5);
      } else if (event.key.toLowerCase() === 'm') {
        player.toggleMute();
      } else if (event.key.toLowerCase() === 'n') {
        player.next();
      } else if (event.key.toLowerCase() === 'p') {
        player.previous();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [importFiles, player, query]);

  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types || []).includes('Files');

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const resetDrag = () => {
      dragDepth.current = 0;
      setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      resetDrag();
      const files = Array.from(event.dataTransfer?.files || []);
      const paths = files
        .map((file) => window.lumen?.getPathForFile(file) || '')
        .filter(Boolean);
      if (paths.length) importPaths(paths);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('blur', resetDrag);
    window.addEventListener('dragend', resetDrag);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('blur', resetDrag);
      window.removeEventListener('dragend', resetDrag);
    };
  }, [importPaths]);

  const recentTracks = useMemo(
    () => [...library].sort((a, b) => b.addedAt - a.addedAt).slice(0, 3),
    [library],
  );

  const totalDuration = library.reduce((sum, track) => sum + (track.duration || 0), 0);
  const queueTracks = useMemo(
    () =>
      queue
        .map((id) => library.find((track) => track.id === id))
        .filter((track): track is Track => Boolean(track)),
    [queue, library],
  );

  const tableTitle = searchResults
    ? `“${query.trim()}”`
    : view === 'favorites'
      ? '我的收藏'
      : '所有歌曲';
  const tableKicker = searchResults
    ? 'SEARCH RESULTS'
    : view === 'favorites'
      ? 'FAVORITES · 喜欢的声音'
      : 'LIBRARY · 本地音乐库';
  const tableSubtitle = searchResults
    ? `${visibleTracks.length} 个结果 · 在 ${library.length} 首歌曲中搜索`
    : view === 'favorites'
      ? `${visibleTracks.length} 首收藏 · 喜欢的声音会一直留在这里`
      : `${library.length} 首歌曲 · ${formatTotalDuration(totalDuration)} · 全部保存在本地`;

  const appStyle = {
    '--accent-a': palette.accentA,
    '--accent-b': palette.accentB,
    '--accent-glow': palette.glow,
    '--ambient-color': palette.ambient,
    '--deep-color': palette.dark,
  } as CSSProperties;

  return (
    <div className="app" style={appStyle}>
      <TitleBar />

      <div className="app-shell">
        <div className="sidebar-surface">
          <Sidebar
            tracks={library}
            recentTracks={recentTracks}
            view={view}
            query={query}
            searchRef={searchRef}
            favoritesCount={favorites.size}
            queueCount={queueTracks.length}
            importing={Boolean(scanProgress)}
            currentTrackId={currentId}
            onViewChange={handleViewChange}
            onQueryChange={setQuery}
            onImportFiles={importFiles}
            onImportFolder={importFolder}
            onSelectTrack={selectTrack}
          />
        </div>

        <div className="main-column">
          <div className="main-body">
            <main className={cn('stage', { 'stage--table': searchResults || view !== 'now' })}>
              {searchResults || view !== 'now' ? (
                <TrackTable
                  kicker={tableKicker}
                  title={tableTitle}
                  subtitle={tableSubtitle}
                  tracks={visibleTracks}
                  currentTrackId={currentId}
                  playing={player.isPlaying}
                  favorites={favorites}
                  missingPaths={missingPaths}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  emptyKind={searchResults ? 'search' : view === 'favorites' ? 'favorites' : 'library'}
                  canAddMusic
                  onSort={handleSort}
                  onSelectTrack={selectTrack}
                  onToggleFavorite={toggleFavorite}
                  onRemoveTrack={removeTrack}
                  onPlayAll={() => playAll(visibleTracks)}
                  onShuffleAll={() => shuffleAll(visibleTracks)}
                  onImport={importFiles}
                  onClearSearch={() => setQuery('')}
                />
              ) : (
                <NowPlaying
                  track={currentTrack}
                  playing={player.isPlaying}
                  favorite={favorite}
                  onToggleFavorite={() => currentTrack && toggleFavorite(currentTrack.id)}
                  onImportFiles={importFiles}
                  onImportFolder={importFolder}
                  onShowInFolder={showInFolder}
                />
              )}
            </main>

            <QueuePanel
              tracks={queueTracks}
              currentTrack={currentTrack}
              playing={player.isPlaying}
              onSelectTrack={selectTrack}
              onRemoveTrack={removeFromQueue}
              onClearQueue={clearQueue}
            />
          </div>

          <PlayerDock
            track={currentTrack}
            playing={player.isPlaying}
            buffering={player.buffering}
            currentTime={player.currentTime}
            duration={player.duration}
            buffered={player.buffered}
            volume={player.volume}
            muted={player.muted}
            shuffle={player.shuffle}
            repeat={player.repeat}
            rate={player.rate}
            favorite={favorite}
            onToggle={player.toggle}
            onNext={player.next}
            onPrevious={player.previous}
            onSeek={player.seek}
            onVolumeChange={player.setVolume}
            onToggleMute={player.toggleMute}
            onToggleShuffle={player.toggleShuffle}
            onCycleRepeat={player.cycleRepeat}
            onRateChange={player.setRate}
            onToggleFavorite={() => currentTrack && toggleFavorite(currentTrack.id)}
          />
        </div>
      </div>

      <audio ref={player.audioRef} preload="metadata" {...player.audioEvents} />

      <div className={cn('drop-overlay', { 'is-visible': dragging })} aria-hidden={!dragging}>
        <div className="drop-overlay__glass">
          <div className="drop-overlay__orbit">
            <FileAudio size={38} strokeWidth={1.3} />
          </div>
          <span className="drop-overlay__kicker">
            <Sparkles size={13} />
            RELEASE TO IMPORT
          </span>
          <h2>松手，让音乐落进来。</h2>
          <p>支持 MP3、M4A、AAC、WAV、FLAC、OGG、OPUS，也可以直接拖入整个文件夹。</p>
          <div className="drop-overlay__formats">
            <span>MP3</span>
            <span>M4A</span>
            <span>WAV</span>
            <span>FLAC</span>
            <span>OGG</span>
          </div>
        </div>
      </div>

      {scanProgress && (
        <div className="import-progress" role="status" aria-live="polite">
          <span className="import-progress__icon">
            <LoaderCircle size={17} className="spin" />
          </span>
          <div className="import-progress__copy">
            <strong>正在读取音乐信息</strong>
            <span title={scanProgress.current}>
              {scanProgress.done} / {scanProgress.total} · {scanProgress.current || '准备中'}
            </span>
          </div>
          <div className="import-progress__bar">
            <span
              style={{
                width: `${scanProgress.total ? (scanProgress.done / scanProgress.total) * 100 : 4}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <GlassProvider
      theme="dark"
      material="clear"
      density="comfortable"
      transparency="system"
      motion="system"
      contrast="system"
      platform="desktop"
      renderer="auto"
      enableSvgAuto
      strings={glassStrings}
    >
      <GlassBackdrop tone="dark" className="app-backdrop">
        <ToastProvider limit={3}>
          <LumenApp />
        </ToastProvider>
      </GlassBackdrop>
    </GlassProvider>
  );
}
