export interface Track {
  id: string;
  path: string;
  fileName: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  genre: string[];
  duration: number;
  bitrate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  channels: number | null;
  codec: string;
  lossless: boolean;
  container: string;
  quality: string;
  extension: string;
  size: number;
  modifiedAt: number;
  addedAt: number;
  coverUrl: string | null;
  streamUrl: string;
  metadataError?: string | null;
}

export type LibraryView = 'now' | 'library' | 'favorites';
export type RepeatMode = 'off' | 'all' | 'one';
export type SortKey = 'added' | 'title' | 'artist' | 'album' | 'duration';

export interface ImportResult {
  tracks: Track[];
  failed: number;
  cancelled: boolean;
}

export interface ScanProgress {
  active: boolean;
  done: number;
  total: number;
  current: string;
}

export interface LumenApi {
  platform: string;
  pickFiles: () => Promise<ImportResult>;
  pickFolder: () => Promise<ImportResult>;
  importPaths: (paths: string[]) => Promise<ImportResult>;
  consumeLaunchPaths: () => Promise<string[]>;
  verifyPaths: (paths: string[]) => Promise<Record<string, boolean>>;
  showItemInFolder: (path: string) => Promise<void>;
  windowControl: (action: 'minimize' | 'maximize' | 'close') => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  setPlaybackState: (state: {
    playing: boolean;
    progress?: number;
    trackId?: string | null;
  }) => void;
  getPathForFile: (file: File) => string;
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;
  onOpenFiles: (callback: (paths: string[]) => void) => () => void;
  onWindowMaximized: (callback: (maximized: boolean) => void) => () => void;
  onMediaCommand: (callback: (command: string) => void) => () => void;
}

declare global {
  interface Window {
    lumen: LumenApi;
  }
}
