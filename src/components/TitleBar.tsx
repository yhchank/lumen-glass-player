import { useEffect, useState } from 'react';
import { Copy, Minus, Play, Square, X } from 'lucide-react';

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!window.lumen) return;
    void window.lumen.isMaximized().then(setMaximized);
    return window.lumen.onWindowMaximized(setMaximized);
  }, []);

  const control = (action: 'minimize' | 'maximize' | 'close') => {
    void window.lumen?.windowControl(action).then((value) => {
      if (action !== 'close') setMaximized(value);
    });
  };

  return (
    <header className="titlebar" onDoubleClick={() => control('maximize')}>
      <div className="titlebar__brand">
        <span className="brand-mark" aria-hidden="true">
          <Play size={11} fill="currentColor" strokeWidth={0} />
        </span>
        <span className="brand-word">LUMEN</span>
        <span className="brand-cn">流光</span>
      </div>

      <div className="titlebar__status" aria-hidden="true">
        <span className="status-pulse" />
        <span>LOCAL HIGH-FIDELITY</span>
      </div>

      <div className="window-controls" onDoubleClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="window-control"
          title="最小化"
          aria-label="最小化"
          onClick={() => control('minimize')}
        >
          <Minus size={15} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="window-control"
          title={maximized ? '还原' : '最大化'}
          aria-label={maximized ? '还原' : '最大化'}
          onClick={() => control('maximize')}
        >
          {maximized ? (
            <Copy size={13} strokeWidth={1.7} />
          ) : (
            <Square size={12} strokeWidth={1.7} />
          )}
        </button>
        <button
          type="button"
          className="window-control window-control--close"
          title="关闭"
          aria-label="关闭"
          onClick={() => control('close')}
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
