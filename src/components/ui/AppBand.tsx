// src/components/ui/AppBand.tsx
import WindowControls from "./WindowControls";

/**
 * The strip across the top of a screen that has no panels: the vault picker and the error screen. The window has no title bar,
 * so this is it: an empty spot of it moves the window (and a double-click maximizes it) and the window buttons are at its right.
 * In the app the buttons float over the notch of the main panel instead (see _app).
 */
function AppBand() {
  return (
    <div className="app-band" data-tauri-drag-region>
      <WindowControls />
    </div>
  );
}

export default AppBand;
