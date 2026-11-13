// src/lib/textMenu.ts
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { MenuEntry } from "../components/ContextMenu";

export type TextField = HTMLInputElement | HTMLTextAreaElement;

export const isTextField = (target: EventTarget | null): target is TextField =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

/**
 * The right-click menu of a text field: Undo, Redo, Cut, Copy, Paste, Select all. It stands in for
 * the webview's own menu. Every edit goes through execCommand so it lands on the field's undo
 * stack and fires `input` (a controlled React field stays in sync). The field keeps focus while
 * the menu is open (see ContextMenu's keepFocus), so its selection is still there when a row runs.
 */
export function textFieldEntries(el: TextField): MenuEntry[] {
  const locked = el.readOnly || el.disabled;
  const noSelection = el.selectionStart === el.selectionEnd;
  const selected = () =>
    el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  const run = (command: string, value?: string) => {
    el.focus();
    document.execCommand(command, false, value);
  };

  return [
    { label: "Undo", disabled: locked, onSelect: () => run("undo") },
    { label: "Redo", disabled: locked, onSelect: () => run("redo") },
    "separator",
    {
      label: "Cut",
      disabled: locked || noSelection,
      // Delete only once the clipboard has the text
      onSelect: () =>
        writeText(selected())
          .then(() => run("delete"))
          .catch(console.error),
    },
    {
      label: "Copy",
      disabled: noSelection,
      onSelect: () => writeText(selected()).catch(console.error),
    },
    {
      label: "Paste",
      disabled: locked,
      onSelect: () =>
        readText()
          .then((text) =>
            run(
              "insertText",
              el instanceof HTMLInputElement
                ? text.replace(/\r?\n/g, " ")
                : text,
            ),
          )
          .catch(console.error),
    },
    "separator",
    {
      label: "Select all",
      onSelect: () => {
        el.focus();
        el.select();
      },
    },
  ];
}
