// src/components/note/NoteEditor.tsx
import {
  type CSSProperties,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBack } from "../../hooks/useBack";
import { useClipboard } from "../../hooks/useClipboard";
import { useCodeWrap } from "../../hooks/useCodeWrap";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useFindState, useTextareaFind } from "../../hooks/useFind";
import { useImageInsert } from "../../hooks/useImageInsert";
import type { AddItemFields } from "../../hooks/useItems";
import { replaceText, useMarkdownFormat } from "../../hooks/useMarkdownFormat";
import { autosaveDelay } from "../../lib/autosave";
import { findFenceAt, gutterNumbers, setFenceLang } from "../../lib/codeBlocks";
import { leaveAction } from "../../lib/editConflict";
import {
  activeFormats,
  continueList,
  shiftListIndent,
} from "../../lib/markdownFormat";
import { perfRender } from "../../lib/perf";
import { isCodeBody } from "../../lib/utils";
import type { Folder, Item, ItemKind } from "../../types";
import Button from "../ui/Button";
import ColumnResizer from "../ui/ColumnResizer";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import { CheckIcon, ClipboardIcon } from "../ui/Icon";
import MoreButton from "../ui/MoreButton";
import Tooltip from "../ui/Tooltip";
import CodeGutter from "./CodeGutter";
import CodeLanguagePicker from "./CodeLanguagePicker";
import CopyNoteButton from "./CopyNoteButton";
import FindBar from "./FindBar";
import ItemHeader from "./ItemHeader";
import MarkdownToolbar, {
  formatMenuEntry,
  type HistoryCommand,
} from "./MarkdownToolbar";
import WordCount from "./WordCount";

// The count under the note follows the text this long after the last key: on a note of megabytes counting takes
// a good fraction of a second, which typing must not wait for
const WORD_COUNT_DELAY_MS = 300;

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
  // Create-or-update and keep the editor open (the parent decides which). Resolves false when the write failed.
  onSave: (fields: AddItemFields) => Promise<boolean>;
  onDirtyChange?: (isDirty: boolean) => void;
  onDone: () => void;
  canLeave: boolean;
  // Focus the text on mount, so typing can start (default). Off on a phone for a blank draft behind the list (the soft keyboard
  // would rise over it) and for an existing note (Edit opens it as it was read; the first tap in the text raises the keyboard)
  focusOnMount?: boolean;
  // Parent calls flushRef.current() before navigating away so pending edits are saved
  flushRef: React.RefObject<(() => void) | null>;
  // Goes up on each Ctrl+F; the find bar opens when it changes
  findSignal: number;
  // The parent calls insertImagesRef.current(files) to put image links (files already in attachments/) at the cursor
  insertImagesRef: React.RefObject<((files: string[]) => void) | null>;
  // Duplicate, reveal and move to trash for the open item (off for a draft that is not saved yet)
  moreEntries: MenuEntry[];
  // The file of this note was changed outside Graphene while there is typing here that is not saved (lib/editConflict): the bar asks,
  // and nothing is saved until it is answered. Keep mine: the parent forgets their version and this saves the editor's text over the
  // file. onTakeTheirs: the parent adopts their version and reopens the editor on it; with `copy` (a flush while the question is open)
  // the editor's text is first saved as a copy note, so neither version is lost
  conflict: boolean;
  onKeepMine: () => void;
  onTakeTheirs: (copy: AddItemFields | null) => void;
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
  focusOnMount = true,
  flushRef,
  findSignal,
  insertImagesRef,
  moreEntries,
  conflict,
  onKeepMine,
  onTakeTheirs,
}: NoteEditorProps) {
  perfRender("NoteEditor");
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
  // The toolbar's undo and redo walk the same history as Ctrl+Z (the edits above go through execCommand to keep it)
  const applyHistory = useCallback((command: HistoryCommand) => {
    textareaRef.current?.focus();
    document.execCommand(command);
  }, []);
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

  // The caret and selection are offsets into the textarea's value, which always uses "\n"; the text of a Windows file
  // has "\r\n" until the first edit. Converted once per text, and not at all when there is no "\r" (the usual case).
  const text = useMemo(
    () => (body.includes("\r") ? body.replace(/\r\n/g, "\n") : body),
    [body],
  );

  // The code block the caret is in, if any
  const block = useMemo(() => findFenceAt(text, caret), [text, caret]);

  // Long lines of code wrap or scroll (Alt+Z). One textarea holds the whole note, so only a note that is code (it starts
  // with a fence) can scroll sideways; the text of any other note always wraps.
  const wrap = useCodeWrap();
  const wraps = wrap === "on" || !isCodeBody(text);

  // Line numbers beside the code. They follow the text a little behind a key (a deferred value), so typing never waits
  // for a note of thousands of lines; null when no line is in a code block, or the note is too big to draw them for.
  const gutterText = useDeferredValue(text);
  const numbers = useMemo(() => gutterNumbers(gutterText), [gutterText]);
  const gutterDigits = useMemo(
    () => String(Math.max(1, ...(numbers ?? []).map((n) => n ?? 0))).length,
    [numbers],
  );

  // The toolbar buttons that are on at the caret or selection light up
  const active = useMemo(
    () => activeFormats(text, caret, selEnd),
    [text, caret, selEnd],
  );

  const countedBody = useDebouncedValue(body, WORD_COUNT_DELAY_MS);

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
    if (focusOnMount) el.focus();
    el.setSelectionRange(start, start);
    trackSelection(el);
  }, []);

  // Empty title saves as "Untitled", so compare the resolved value or an untitled item is dirty forever
  const resolvedTitle = title.trim() || "Untitled";

  // The newest save has not landed yet, or it failed: the note in memory is ahead of the disk, so it stays unsaved
  // (a flush on leaving saves it again) until a save succeeds
  const [saving, setSaving] = useState(false);
  const saveNo = useRef(0);
  // When the oldest edit that no save has taken yet was made: a burst of typing is saved at the latest a while after it
  const dirtySince = useRef<number | null>(null);

  const isDirty = useMemo(() => {
    if (saving) return true;
    if (initialItem) {
      return (
        resolvedTitle !== initialItem.title ||
        body !== initialItem.body ||
        folderId !== initialItem.folderId
      );
    }
    // A new draft only counts once there is content beyond the seed, so an untouched draft never creates an item
    return title.length > 0 || body !== seedBody;
  }, [saving, title, resolvedTitle, body, seedBody, folderId, initialItem]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const save = useCallback(() => {
    const no = ++saveNo.current;
    dirtySince.current = null; // what is typed from here on is the next burst
    setSaving(true);
    onSave({ title: resolvedTitle, body, folderId }).then((ok) => {
      if (no === saveNo.current) setSaving(!ok);
    });
  }, [resolvedTitle, body, folderId, onSave]);

  // Autosave: `save` changes identity on every edit, which restarts the timer (debounce), but the wait is cut so that
  // a burst of typing with no pause still saves every few seconds (see lib/autosave). It waits while the question about
  // an outside change is open: the file on disk is theirs until the person chooses
  useEffect(() => {
    if (!isDirty || conflict) {
      dirtySince.current = null;
      return;
    }
    const now = Date.now();
    dirtySince.current ??= now;
    const t = setTimeout(save, autosaveDelay(dirtySince.current, now));
    return () => clearTimeout(t);
  }, [isDirty, conflict, save]);

  // The parent calls this before it navigates away (or the vault or window goes) so pending edits are never dropped. With the
  // question open it never writes over the file: the text becomes a copy note and the editor reopens on their version
  useEffect(() => {
    flushRef.current = () => {
      const action = leaveAction(conflict, isDirty);
      if (action === "save") save();
      else if (action === "copy")
        onTakeTheirs({ title: resolvedTitle, body, folderId });
      else if (action === "reload") onTakeTheirs(null);
    };
    return () => {
      flushRef.current = null;
    };
  }, [
    flushRef,
    isDirty,
    conflict,
    save,
    onTakeTheirs,
    resolvedTitle,
    body,
    folderId,
  ]);

  // Keep mine: the parent takes their version as the note (so the save is made against the file that is there), then this text goes over it
  const keepMine = () => {
    onKeepMine();
    save();
  };

  // The Android Back key does what Done does: back to the read view. A new draft with no note to go back to has no Done, so Back
  // leaves the app from there
  useBack(onDone, canLeave);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !conflict) save();
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
  }, [isDirty, conflict, save, onDone]);

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
    // Enter on a list line (bullet, number or task) starts the next item (not while composing text, with a modifier, or inside a code block)
    if (
      e.key === "Enter" &&
      !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) &&
      !e.nativeEvent.isComposing &&
      !block
    ) {
      const el = e.currentTarget;
      const edit = continueList(el.value, el.selectionStart, el.selectionEnd);
      if (edit) {
        e.preventDefault();
        replaceText(el, edit);
        return;
      }
    }
    // Tab / Shift+Tab on a list line moves the whole line in or out: a sub-item
    if (e.key === "Tab" && !(e.ctrlKey || e.metaKey || e.altKey) && !block) {
      const el = e.currentTarget;
      const edit = shiftListIndent(
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
                <Button variant="solid" size="sm" onClick={onDone}>
                  Done
                </Button>
              </Tooltip>
            )}
          </div>
        }
      />

      {conflict && (
        <div className="note-editor__conflict" role="alert">
          <span>This note was changed outside Graphene</span>
          <div className="note-editor__conflict-actions">
            <Tooltip label="Save what is in the editor over the changed file">
              <Button size="sm" onClick={keepMine}>
                Keep mine
              </Button>
            </Tooltip>
            <Tooltip label="Open the changed file. What you typed since the last save is discarded">
              <Button size="sm" onClick={() => onTakeTheirs(null)}>
                Load theirs
              </Button>
            </Tooltip>
          </div>
        </div>
      )}

      {find.open && (
        <FindBar
          query={find.query}
          onQueryChange={find.setQuery}
          finder={finder}
          onClose={closeFind}
          focusKey={findSignal}
        />
      )}

      <div className="note-editor__body" data-scrollbar>
        <div className="note-editor__editor-wrap">
          <MarkdownToolbar
            onFormat={applyFormat}
            onHistory={applyHistory}
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
          <div
            className="note-editor__text"
            data-wrap={wraps ? "on" : "off"}
            style={{ "--gutter-digits": gutterDigits } as CSSProperties}
          >
            <textarea
              ref={textareaRef}
              className="note-editor__textarea"
              data-pristine={!initialItem && body === seedBody}
              data-gutter={numbers !== null}
              data-scrollbar
              wrap={wraps ? undefined : "off"}
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
            {numbers && (
              <CodeGutter
                text={gutterText}
                numbers={numbers}
                textareaRef={textareaRef}
              />
            )}
            {/* The edges run beside the writing box, not past the toolbar and the word count */}
            <ColumnResizer />
          </div>
          <WordCount body={countedBody} updatedAt={initialItem?.updatedAt} />
        </div>
      </div>
    </div>
  );
}

export default memo(NoteEditor);
