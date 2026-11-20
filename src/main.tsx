// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./assets/styles/main.scss";
import { applyFontPrefs } from "./lib/fontPrefs";
import { initTheme } from "./lib/theme";

// Before the first render, so the wrong theme or font never flashes
initTheme();
applyFontPrefs();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
