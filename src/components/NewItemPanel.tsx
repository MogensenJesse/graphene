// src/components/NewItemPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClipboard } from "../hooks/useClipboard";
import type { AddItemFields } from "../hooks/useItems";
import { replaceText, useMarkdownFormat } from "../hooks/useMarkdownFormat";
import { findFenceAt, setFenceLang } from "../lib/codeBlocks";
import type { Folder, Item } from "../types";
import CodeLanguagePicker from "./CodeLanguagePicker";
import type { MenuEntry } from "./ContextMenu";
import { useContextMenu } from "./ContextMenuProvider";
import CopyNoteButton from "./CopyNoteButton";
import { CheckIcon, ClipboardIcon } from "./Icon";
import ItemHeader from "./ItemHeader";
import MarkdownToolbar, { formatMenuEntry } from "./MarkdownToolbar";

const AUTOSAVE_DELAY_MS = 800;

// A new code draft starts as an empty fenced block (the same text the toolbar's code-block button
// inserts) with the caret inside it. The word after the opening fence is the language.
const CODE_SEED = "```\n\n```";
const CODE_SEED_CARET = 4;

// Tab inserts spaces instead of leaving the field. execCommand is deprecated but is the only way
// to insert text without wiping the textarea's undo history.
function insertTabOnTab(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
  if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
    return;
  }
  e.preventDefault();
  document.execCommand("insertText", false, "  ");
}

interface NewItemPanelProps {
  folders: Folder[];
  initialItem?: Item;
  // Only used for a brand-new draft
  newKind?: "note" | "code";
  // Only used for a brand-new draft; existing items always keep their own folder
  defaultFolderId?: string | null;
  // Create-or-update and keep the editor open (the parent decides which)
  onSave: (fields: AddItemFields) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onDone: () => void;
  canLeave: boolean;
  // Parent calls flushRef.current() before navigating away so pending edits are saved
  flushRef: React.RefObject<(() => void) | null>;
}

function NewItemPanel({
  folders,
  initialItem,
  newKind = "note",
  defaultFolderId,
  onSave,
  onDirtyChange,
  onDone,
  canLeave,
  flushRef,
}: NewItemPanelProps) {
  const seedBody = newKind === "code" ? CODE_SEED : "";
  const [title, setTitle] = useState(initialItem?.title ?? "");
  const [body, setBody] = useState(initialItem?.body ?? seedBody);
  // An existing root-level item has folderId null, so `??` chaining would wrongly pick the default
  const [folderId, setFolderId] = useState<string | null>(() => {
    if (initialItem) return initialItem.folderId;
    return defaultFolderId ?? null;
  });

  const [caret, setCaret] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const applyFormat = useMarkdownFormat(textareaRef);
  const { open, openText } = useContextMenu();
  const { copy } = useClipboard();

  // The code block the caret is in, if any. A textarea value always uses "\n", so match that.
  const block = useMemo(
    () => findFenceAt(body.replace(/\r\n/g, "\n"), caret),
    [body, caret],
  );

  // Start typing straight away: focus the body on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only; a new draft remounts the panel through its key
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start =
      !initialItem && newKind === "code" ? CODE_SEED_CARET : el.value.length;
    el.focus();
    el.setSelectionRange(start, start);
    setCaret(start);
  }, []);

  // Empty title saves as "untitled", so compare the resolved value or an untitled item is dirty forever
  const resolvedTitle = title.trim() || "untitled";

  const isDirty = useMemo(() => {
    if (initialItem) {
      return (
        resolvedTitle !== initialItem.title ||
        body !== initialItem.body ||
        folderId !== initialItem.folderId
      );
    }
    // A new draft only counts once there is content beyond the seed, so an untouched draft never creates an item
    return title.length > 0 || body !== seedBody;
  }, [title, resolvedTitle, body, seedBody, folderId, initialItem]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const save = useCallback(() => {
    onSave({ title: resolvedTitle, body, folderId });
  }, [resolvedTitle, body, folderId, onSave]);

  // Autosave: `save` changes identity on every edit, which restarts the timer (debounce)
  useEffect(() => {
    if (!isDirty) return;
    const t = setTimeout(save, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [isDirty, save]);

  // The parent calls this before it navigates away so pending edits are never dropped
  useEffect(() => {
    flushRef.current = () => {
      if (isDirty) save();
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, isDirty, save]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) save();
      }
      if (e.key === "Escape") {
        // Only when focus is in the editor or nowhere; sidebar inputs handle their own Escape
        const target = e.target as Node;
        if (target === document.body || panelRef.current?.contains(target)) {
          onDone();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDirty, save, onDone]);

  const changePickerOpen = (open: boolean) => {
    setPickerOpen(open);
    if (!open) textareaRef.current?.focus({ preventScroll: true });
  };

  // Rewrite the opening fence of the block the caret is in; keep the caret where it was in the text
  const applyLang = (lang: string) => {
    const el = textareaRef.current;
    if (!block || !el) return;
    const delta = lang.length - block.lang.length;
    const nextCaret =
      caret <= block.langStart
        ? caret
        : caret >= block.langEnd
          ? caret + delta
          : block.langStart + lang.length;
    replaceText(el, {
      value: setFenceLang(el.value, block, lang),
      ss: nextCaret,
      se: nextCaret,
    });
  };

  // What a right-click offers on the header, toolbar and empty space (the text has its own menu)
  const panelEntries: MenuEntry[] = [
    ...(canLeave
      ? [
          {
            label: "Done",
            icon: <CheckIcon size={14} />,
            onSelect: onDone,
          },
        ]
      : []),
    {
      label: "Copy note",
      icon: <ClipboardIcon size={14} />,
      disabled: !body,
      onSelect: () => copy(body),
    },
  ];

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Z and Ctrl+Y are native; spell out Ctrl+Shift+Z in case the webview does not map it
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "z"
    ) {
      e.preventDefault();
      document.execCommand("redo");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      if (e.key === "l" && block) {
        e.preventDefault();
        setPickerOpen(true);
        return;
      }
      if (e.key === "b") {
        e.preventDefault();
        applyFormat("bold");
        return;
      }
      if (e.key === "i") {
        e.preventDefault();
        applyFormat("italic");
        return;
      }
    }
    insertTabOnTab(e);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; every entry has a button or shortcut elsewhere
    <div
      className="new-item-panel"
      ref={panelRef}
      onContextMenu={(e) => open(e, panelEntries)}
    >
      <ItemHeader
        menuEntries={panelEntries}
        title={title}
        onTitleChange={setTitle}
        liveTitle
        folders={folders}
        folderId={folderId}
        onFolderChange={setFolderId}
        updatedAt={initialItem?.updatedAt}
        isDirty={isDirty}
        actions={
          <div className="item-header__actions">
            <CopyNoteButton text={body} />
            {canLeave && (
              <button
                type="button"
                className="item-header__btn item-header__btn--primary"
                onClick={onDone}
                title="Done (Esc)"
              >
                done
              </button>
            )}
          </div>
        }
      />

      <div className="new-item-panel__body">
        <div className="new-item-panel__editor-wrap">
          <MarkdownToolbar onFormat={applyFormat}>
            {block && (
              <CodeLanguagePicker
                lang={block.lang}
                open={pickerOpen}
                onOpenChange={changePickerOpen}
                onPick={applyLang}
              />
            )}
          </MarkdownToolbar>
          <textarea
            ref={textareaRef}
            className="new-item-panel__textarea"
            placeholder="start writing…"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setCaret(e.target.selectionStart);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={handleBodyKeyDown}
            onContextMenu={(e) =>
              openText(e, ["separator", formatMenuEntry(applyFormat)])
            }
          />
        </div>
      </div>
    </div>
  );
}

export default NewItemPanel;
