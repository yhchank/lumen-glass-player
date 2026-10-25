import { useEffect, useState, type CSSProperties } from 'react';
import { Disc3, Music2 } from 'lucide-react';
import type { Track } from '../types';
import { cn } from '../lib/format';

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) % 360;
  }
  return result;
}

interface CoverArtProps {
  track: Track | null;
  className?: string;
  variant?: 'hero' | 'dock' | 'row' | 'queue';
  loading?: 'eager' | 'lazy';
  showFallbackIcon?: boolean;
}

export function CoverArt({
  track,
  className,
  variant = 'row',
  loading = 'lazy',
  showFallbackIcon = true,
}: CoverArtProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [track?.coverUrl]);

  const hue = track ? hash(track.id) : 168;
  const style = {
    '--cover-hue': `${hue}`,
    '--cover-hue-2': `${(hue + 58) % 360}`,
  } as CSSProperties;

  return (
    <div className={cn('cover-art', `cover-art--${variant}`, className)} style={style}>
      {track?.coverUrl && !failed ? (
        <img
          src={track.coverUrl}
          alt=""
          draggable={false}
          loading={loading}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-art__fallback" aria-hidden="true">
          <div className="cover-art__orbit cover-art__orbit--one" />
          <div className="cover-art__orbit cover-art__orbit--two" />
          {showFallbackIcon &&
            (variant === 'hero' ? (
              <Disc3 size={54} strokeWidth={1.15} />
            ) : (
              <Music2 size={variant === 'dock' ? 18 : 22} strokeWidth={1.5} />
            ))}
          <span className="cover-art__initial">{track?.title?.slice(0, 1) || 'L'}</span>
        </div>
      )}
      <span className="cover-art__sheen" aria-hidden="true" />
    </div>
  );
}
