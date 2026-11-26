// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./assets/styles/main.scss";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import { applyCodeWrap } from "./lib/codeWrap";
import { applyNoteWidth } from "./lib/columnWidth";
import { applyFontPrefs } from "./lib/fontPrefs";
import { observeIpc, observeLongFrames, perfMark } from "./lib/perf";
import { IS_ANDROID } from "./lib/platform";
import { initScrollbars } from "./lib/scrollbars";
import { initTheme } from "./lib/theme";

perfMark("main");
observeLongFrames();
observeIpc();

// Before the first render, so the wrong theme or font never flashes
initTheme();
applyFontPrefs();
applyCodeWrap();
applyNoteWidth();
if (IS_ANDROID) document.documentElement.dataset.platform = "android";
initScrollbars();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
