// src/components/WindowControls.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

const appWindow = getCurrentWindow();

interface WindowControlsProps {
  className?: string;
}

function WindowControls({ className }: WindowControlsProps) {
  const [maximized, setMaximized] = useState(false);

  // Keep the maximize icon honest, including when the user drags the window out of a snapped state
  useEffect(() => {
    const sync = () =>
      appWindow.isMaximized().then(setMaximized).catch(console.error);
    sync();
    const unlisten = appWindow.onResized(sync);
    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, []);

  const maximizeLabel = maximized ? "Restore" : "Maximize";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: swallows the right-click so the app menu does not open over the window buttons
    <div
      className={`app__win-controls${className ? ` ${className}` : ""}`}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="app__win-btn"
        onClick={() => appWindow.minimize()}
        aria-label="Minimize"
        title="Minimize"
      >
        <svg
          width="10"
          height="1"
          viewBox="0 0 10 1"
          fill="none"
          aria-hidden="true"
        >
          <rect width="10" height="1" rx="0.5" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        className="app__win-btn"
        onClick={() => appWindow.toggleMaximize()}
        aria-label={maximizeLabel}
        title={maximizeLabel}
      >
        {maximized ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="0.6" y="2.8" width="6.6" height="6.6" rx="1" />
            <path d="M2.8 2.8V1.6a1 1 0 0 1 1-1h4.6a1 1 0 0 1 1 1v4.6a1 1 0 0 1-1 1H7.2" />
          </svg>
        ) : (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="app__win-btn app__win-btn--close"
        onClick={() => appWindow.close()}
        aria-label="Close"
        title="Close"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1L9 9M9 1L1 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default WindowControls;
