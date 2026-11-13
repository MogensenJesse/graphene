// src/components/ContextMenuProvider.tsx
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isTextField, textFieldEntries } from "../lib/textMenu";
import ContextMenu, { type MenuEntry } from "./ContextMenu";

interface ShownMenu {
  id: number; // a new id remounts the menu, so it re-clamps and re-reads the focus it hands back
  x: number;
  y: number;
  entries: MenuEntry[];
  keepFocus: boolean;
}

interface ContextMenuApi {
  /**
   * Shows `entries` at the cursor and keeps the event from the menus behind this surface.
   * A text field is left alone: it gets the text menu.
   */
  open: (e: React.MouseEvent, entries: MenuEntry[]) => void;
  /** Same, anchored on a point (opened from the keyboard) */
  openAt: (x: number, y: number, entries: MenuEntry[]) => void;
  /** The text menu of the field under the cursor, with `extra` entries below it */
  openText: (e: React.MouseEvent, extra?: MenuEntry[]) => void;
}

const ContextMenuContext = createContext<ContextMenuApi | null>(null);

export function useContextMenu(): ContextMenuApi {
  const api = useContext(ContextMenuContext);
  if (!api) throw new Error("useContextMenu needs a ContextMenuProvider");
  return api;
}

/**
 * Owns the one right-click menu of the app and keeps the webview's own menu from ever showing.
 * Surfaces call `open` from their onContextMenu; whatever they leave unhandled lands in the
 * fallback below (text fields get the text menu, a text selection gets Copy).
 */
function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<ShownMenu | null>(null);
  const close = useCallback(() => setMenu(null), []);

  const show = useCallback(
    (x: number, y: number, entries: MenuEntry[], keepFocus: boolean) =>
      setMenu((prev) => ({
        id: (prev?.id ?? 0) + 1,
        x,
        y,
        entries,
        keepFocus,
      })),
    [],
  );

  const api = useMemo<ContextMenuApi>(
    () => ({
      open: (e, entries) => {
        if (isTextField(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        show(e.clientX, e.clientY, entries, false);
      },
      openAt: (x, y, entries) => show(x, y, entries, false),
      openText: (e, extra = []) => {
        const el = e.target;
        if (!isTextField(el)) return;
        e.preventDefault();
        e.stopPropagation();
        show(e.clientX, e.clientY, [...textFieldEntries(el), ...extra], true);
      },
    }),
    [show],
  );

  useEffect(() => {
    // Capture phase: a surface that stops the event must not bring the native menu back
    const block = (e: MouseEvent) => e.preventDefault();
    // Bubble phase: only reached when no surface took the event
    const fallback = (e: MouseEvent) => {
      if (isTextField(e.target)) {
        show(e.clientX, e.clientY, textFieldEntries(e.target), true);
        return;
      }
      const selection = window.getSelection()?.toString() ?? "";
      if (selection)
        show(
          e.clientX,
          e.clientY,
          [
            {
              label: "Copy",
              onSelect: () => writeText(selection).catch(console.error),
            },
          ],
          true,
        );
    };
    window.addEventListener("contextmenu", block, true);
    document.addEventListener("contextmenu", fallback);
    return () => {
      window.removeEventListener("contextmenu", block, true);
      document.removeEventListener("contextmenu", fallback);
    };
  }, [show]);

  return (
    <ContextMenuContext.Provider value={api}>
      {children}
      {menu && (
        <ContextMenu
          key={menu.id}
          x={menu.x}
          y={menu.y}
          entries={menu.entries}
          keepFocus={menu.keepFocus}
          onClose={close}
        />
      )}
    </ContextMenuContext.Provider>
  );
}

export default ContextMenuProvider;
