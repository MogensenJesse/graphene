// src/components/note/NoteEditor.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClipboard } from "../../hooks/useClipboard";
import { useFindState, useTextareaFind } from "../../hooks/useFind";
import { useImageInsert } from "../../hooks/useImageInsert";
import type { AddItemFields } from "../../hooks/useItems";
import { replaceText, useMarkdownFormat } from "../../hooks/useMarkdownFormat";
import { findFenceAt, setFenceLang } from "../../lib/codeBlocks";
import {
  activeFormats,
  continueTask,
  shiftTaskIndent,
} from "../../lib/markdownFormat";
import type { Folder, Item, ItemKind } from "../../types";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import { CheckIcon, ClipboardIcon } from "../ui/Icon";
import MoreButton from "../ui/MoreButton";
import Tooltip from "../ui/Tooltip";
import CodeLanguagePicker from "./CodeLanguagePicker";
import CopyNoteButton from "./CopyNoteButton";
import FindBar from "./FindBar";
import ItemHeader from "./ItemHeader";
import MarkdownToolbar, { formatMenuEntry } from "./MarkdownToolbar";
import WordCount from "./WordCount";

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

interface NoteEditorProps {
  folders: Folder[];
  initialItem?: Item;
  // Only used for a brand-new draft
  newKind?: ItemKind;
  // Only used for a brand-new draft; existing items always keep their own folder
  defaultFolderId?: string | null;
  // Create-or-update and keep the editor open (the parent decides which)
  onSave: (fields: AddItemFields) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onDone: () => void;
  canLeave: boolean;
  // Parent calls flushRef.current() before navigating away so pending edits are saved
  flushRef: React.RefObject<(() => void) | null>;
  // Goes up on each Ctrl+F; the find bar opens when it changes
  findSignal: number;
  // The parent calls insertImagesRef.current(files) to put image links (files already in attachments/) at the cursor
  insertImagesRef: React.RefObject<((files: string[]) => void) | null>;
  // Duplicate, reveal and move to trash for the open item (off for a draft that is not saved yet)
  moreEntries: MenuEntry[];
}

function NoteEditor({
  folders,
  initialItem,
  newKind = "note",
  defaultFolderId,
  onSave,
  onDirtyChange,
  onDone,
  canLeave,
  flushRef,
  findSignal,
  insertImagesRef,
  moreEntries,
}: NoteEditorProps) {
  const seedBody = newKind === "code" ? CODE_SEED : "";
  const [title, setTitle] = useState(initialItem?.title ?? "");
  const [body, setBody] = useState(initialItem?.body ?? seedBody);
  // An existing root-level item has folderId null, so `??` chaining would wrongly pick the default
  const [folderId, setFolderId] = useState<string | null>(() => {
    if (initialItem) return initialItem.folderId;
    return defaultFolderId ?? null;
  });

  const [caret, setCaret] = useState(0);
  const [selEnd, setSelEnd] = useState(0); // where the selection ends (= caret when nothing is selected)
  const [pickerOpen, setPickerOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const applyFormat = useMarkdownFormat(textareaRef);
  const { open, openText } = useContextMenu();
  const { copy } = useClipboard();
  const find = useFindState(findSignal);
  const finder = useTextareaFind(
    textareaRef,
    find.open ? find.query : "",
    body,
  );

  const closeFind = () => {
    find.setOpen(false);
    textareaRef.current?.focus({ preventScroll: true });
  };

  // The code block the caret is in, if any. A textarea value always uses "\n", so match that.
  const block = useMemo(
    () => findFenceAt(body.replace(/\r\n/g, "\n"), caret),
    [body, caret],
  );

  // The toolbar buttons that are on at the caret or selection light up
  const active = useMemo(
    () => activeFormats(body.replace(/\r\n/g, "\n"), caret, selEnd),
    [body, caret, selEnd],
  );

  const trackSelection = (el: HTMLTextAreaElement) => {
    setCaret(el.selectionStart);
    setSelEnd(el.selectionEnd);
  };

  // Start typing straight away: focus the body on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only; a new draft remounts the panel through its key
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start =
      !initialItem && newKind === "code" ? CODE_SEED_CARET : el.value.length;
    el.focus();
    el.setSelectionRange(start, start);
    trackSelection(el);
  }, []);

  // Empty title saves as "Untitled", so compare the resolved value or an untitled item is dirty forever
  const resolvedTitle = title.trim() || "Untitled";

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
      // Only when focus is in the editor or nowhere; sidebar inputs handle their own Escape
      const target = e.target as Node;
      const inEditor =
        target === document.body || panelRef.current?.contains(target);
      if (e.key === "Escape" && inEditor) onDone();
      // Ctrl+Enter: save and go back to the read view, the same as Done
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter" &&
        !e.isComposing &&
        inEditor
      ) {
        e.preventDefault();
        onDone();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDirty, save, onDone]);

  // Image links are relative to the folder the note is saved in (the open item's, else the one picked for the draft)
  const handlePaste = useImageInsert(
    textareaRef,
    initialItem ? initialItem.folderId : folderId,
    insertImagesRef,
  );

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
    "separator",
    ...moreEntries,
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
      // Inside a code block the toolbar is off, and so are its shortcuts
      if (e.key === "b" && !block) {
        e.preventDefault();
        applyFormat("bold");
        return;
      }
      if (e.key === "i" && !block) {
        e.preventDefault();
        applyFormat("italic");
        return;
      }
    }
    // Enter on a task line starts the next task (not while composing text, with a modifier, or inside a code block)
    if (
      e.key === "Enter" &&
      !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) &&
      !e.nativeEvent.isComposing &&
      !block
    ) {
      const el = e.currentTarget;
      const edit = continueTask(el.value, el.selectionStart, el.selectionEnd);
      if (edit) {
        e.preventDefault();
        replaceText(el, edit);
        return;
      }
    }
    // Tab / Shift+Tab on a task line moves the whole line in or out: a sub-task
    if (e.key === "Tab" && !(e.ctrlKey || e.metaKey || e.altKey) && !block) {
      const el = e.currentTarget;
      const edit = shiftTaskIndent(
        el.value,
        el.selectionStart,
        el.selectionEnd,
        e.shiftKey,
      );
      if (edit) {
        e.preventDefault();
        replaceText(el, edit);
        return;
      }
    }
    insertTabOnTab(e);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; every entry has a button or shortcut elsewhere
    <div
      className="note-editor"
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
        isDirty={isDirty}
        actions={
          <div className="item-header__actions">
            <CopyNoteButton text={body} />
            <MoreButton entries={moreEntries} />
            {canLeave && (
              <Tooltip label="Done" keys="Esc">
                <button
                  type="button"
                  className="item-header__btn item-header__btn--primary"
                  onClick={onDone}
                >
                  Done
                </button>
              </Tooltip>
            )}
          </div>
        }
      />

      {find.open && (
        <FindBar
          query={find.query}
          onQueryChange={find.setQuery}
          finder={finder}
          onClose={closeFind}
          focusKey={findSignal}
        />
      )}

      <div className="note-editor__body">
        <div className="note-editor__editor-wrap">
          <MarkdownToolbar
            onFormat={applyFormat}
            active={active}
            disabled={!!block}
          >
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
            className="note-editor__textarea"
            placeholder="Start writing…"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              trackSelection(e.target);
            }}
            onSelect={(e) => trackSelection(e.currentTarget)}
            onKeyDown={handleBodyKeyDown}
            onPaste={handlePaste}
            onContextMenu={(e) =>
              openText(
                e,
                block ? [] : ["separator", formatMenuEntry(applyFormat)],
              )
            }
          />
          <WordCount body={body} updatedAt={initialItem?.updatedAt} />
        </div>
      </div>
    </div>
  );
}

export default NoteEditor;
