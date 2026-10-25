export function formatTime(seconds: number, forceHours = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0 || forceHours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatTotalDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 分钟';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  return `${Math.max(1, minutes)} 分钟`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatSampleRate(rate: number | null): string {
  if (!rate) return '—';
  const khz = rate / 1000;
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`;
}

export function formatBitrate(rate: number | null): string {
  if (!rate) return '—';
  return `${Math.round(rate / 1000)} kbps`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function cn(
  ...values: Array<string | false | null | undefined | Record<string, boolean>>
): string {
  const classes: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (typeof value === 'string') {
      classes.push(value);
    } else {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) classes.push(key);
      }
    }
  }
  return classes.join(' ');
}

export function pluralSongs(count: number): string {
  return `${count} 首歌曲`;
}

export function safeNumber(value: string | number | undefined, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function truncateMiddle(value: string, max = 68): string {
  if (value.length <= max) return value;
  const side = Math.floor((max - 1) / 2);
  return `${value.slice(0, side)}…${value.slice(-side)}`;
}

export function relativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const day = 86400000;
  if (diff < 3600000) return '刚刚添加';
  if (diff < day) return `${Math.floor(diff / 3600000)} 小时前添加`;
  if (diff < day * 7) return `${Math.floor(diff / day)} 天前添加`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(timestamp);
}

export function trackSearchText(track: {
  title: string;
  artist: string;
  album: string;
  fileName: string;
}): string {
  return `${track.title} ${track.artist} ${track.album} ${track.fileName}`.toLocaleLowerCase('zh-CN');
}
