import { useEffect, useRef } from 'react';
import { Copy, ExternalLink, FileAudio, Folder, FolderOpen, X } from 'lucide-react';
import type { FolderInfo } from '../types';

interface FileLocationPanelProps {
  info: FolderInfo;
  onClose: () => void;
  onReveal: () => void;
  onCopy: () => void;
}

export function FileLocationPanel({ info, onClose, onReveal, onCopy }: FileLocationPanelProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const entries = info.entries ?? [];

  return (
    <div
      className="location-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="location-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-title"
      >
        <header className="location-head">
          <div className="location-title" id="location-title">
            <FolderOpen size={16} strokeWidth={1.7} />
            <span>文件位置</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="location-close"
            onClick={onClose}
            aria-label="关闭文件位置"
          >
            <X size={16} />
          </button>
        </header>

        <div className="location-current">
          <span className="location-current__name">{info.file}</span>
          <span className="location-current__path" title={info.folder}>
            {info.folder}
          </span>
        </div>

        <div className="location-meta">
          <span>{info.total ?? entries.length} 项</span>
          {info.truncated && <span>仅显示前 300 项</span>}
        </div>

        <div className="location-list" role="list">
          {entries.map((entry) => (
            <div
              key={entry.name}
              className={`location-row${entry.current ? ' is-current' : ''}`}
              role="listitem"
            >
              {entry.isDirectory ? (
                <Folder size={14} strokeWidth={1.7} />
              ) : (
                <FileAudio size={14} strokeWidth={1.7} />
              )}
              <span className="location-row__name" title={entry.name}>
                {entry.name}
              </span>
              {entry.current && <span className="location-row__badge">当前播放</span>}
            </div>
          ))}
        </div>

        <footer className="location-actions">
          <button type="button" className="location-button" onClick={onCopy}>
            <Copy size={14} strokeWidth={1.7} />
            复制路径
          </button>
          <button
            type="button"
            className="location-button location-button--primary"
            onClick={onReveal}
          >
            <ExternalLink size={14} strokeWidth={1.7} />
            在资源管理器中打开
          </button>
        </footer>
      </section>
    </div>
  );
}
