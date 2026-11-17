// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./assets/styles/main.scss";
import { applyTheme, readThemePref } from "./hooks/useTheme";

// Before the first render, so the wrong theme never flashes
applyTheme(readThemePref());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
