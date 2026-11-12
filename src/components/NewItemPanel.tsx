// src/components/NewItemPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AddNoteFields, AddSnippetFields } from "../hooks/useItems";
import { useMarkdownFormat } from "../hooks/useMarkdownFormat";
import type { Folder, NoteItem, SnippetItem } from "../types";
import { LANGUAGES } from "../types";
import { NoteIcon } from "./Icon";
import ItemHeader from "./ItemHeader";
import MarkdownToolbar from "./MarkdownToolbar";

type Lang = (typeof LANGUAGES)[number];

const AUTOSAVE_DELAY_MS = 800;

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
  initialNote?: NoteItem;
  initialSnippet?: SnippetItem;
  // Only used for a brand-new draft; existing items always keep their own folder
  defaultFolderId?: string | null;
  // Create-or-update and keep the editor open (the parent decides which)
  onSaveNote: (fields: AddNoteFields) => void;
  onSaveSnippet: (fields: AddSnippetFields) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onDone: () => void;
  canLeave: boolean;
  // Parent calls flushRef.current() before navigating away so pending edits are saved
  flushRef: React.RefObject<(() => void) | null>;
}

function NewItemPanel({
  folders,
  initialNote,
  initialSnippet,
  defaultFolderId,
  onSaveNote,
  onSaveSnippet,
  onDirtyChange,
  onDone,
  canLeave,
  flushRef,
}: NewItemPanelProps) {
  const isEditing = !!(initialNote || initialSnippet);
  const [itemType, setItemType] = useState<"note" | "snippet">(
    initialSnippet ? "snippet" : "note",
  );
  const [title, setTitle] = useState(
    initialNote?.title ?? initialSnippet?.title ?? "",
  );
  const [body, setBody] = useState(initialNote?.body ?? "");
  const [lang, setLang] = useState<Lang>(initialSnippet?.lang ?? "JS");
  const [code, setCode] = useState(initialSnippet?.code ?? "");
  const [snippetNote, setSnippetNote] = useState(initialSnippet?.note ?? "");
  // An existing root-level item has folderId null, so `??` chaining would wrongly pick the default
  const [folderId, setFolderId] = useState<string | null>(() => {
    if (initialNote) return initialNote.folderId;
    if (initialSnippet) return initialSnippet.folderId;
    return defaultFolderId ?? null;
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const applyFormat = useMarkdownFormat(textareaRef, body, setBody);

  // Start typing straight away: focus the body on mount and when the type pill changes
  useEffect(() => {
    const el = itemType === "note" ? textareaRef.current : codeRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [itemType]);

  // Empty title saves as "untitled", so compare the resolved value or an untitled item is dirty forever
  const resolvedTitle = title.trim() || "untitled";

  const isDirty = useMemo(() => {
    if (initialNote) {
      return (
        resolvedTitle !== initialNote.title ||
        body !== initialNote.body ||
        folderId !== initialNote.folderId
      );
    }
    if (initialSnippet) {
      return (
        resolvedTitle !== initialSnippet.title ||
        code !== initialSnippet.code ||
        lang !== initialSnippet.lang ||
        snippetNote !== initialSnippet.note ||
        folderId !== initialSnippet.folderId
      );
    }
    // A new draft only counts once there is content, so an empty draft never creates an item
    return (
      title.length > 0 ||
      body.length > 0 ||
      code.length > 0 ||
      snippetNote.length > 0
    );
  }, [
    title,
    resolvedTitle,
    body,
    code,
    lang,
    snippetNote,
    folderId,
    initialNote,
    initialSnippet,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const save = useCallback(() => {
    if (itemType === "note") {
      onSaveNote({ title: resolvedTitle, body, folderId });
    } else {
      onSaveSnippet({
        title: resolvedTitle,
        lang,
        code,
        note: snippetNote,
        folderId,
      });
    }
  }, [
    itemType,
    resolvedTitle,
    body,
    lang,
    code,
    snippetNote,
    folderId,
    onSaveNote,
    onSaveSnippet,
  ]);

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

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
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
    <div className="new-item-panel" ref={panelRef}>
      <ItemHeader
        title={title}
        onTitleChange={setTitle}
        liveTitle
        folders={folders}
        folderId={folderId}
        onFolderChange={setFolderId}
        updatedAt={initialNote?.updatedAt ?? initialSnippet?.updatedAt}
        isDirty={isDirty}
        actions={
          canLeave ? (
            <div className="item-header__actions">
              <button
                type="button"
                className="item-header__btn item-header__btn--primary"
                onClick={onDone}
                title="Done (Esc)"
              >
                done
              </button>
            </div>
          ) : undefined
        }
      />

      {!isEditing && (
        <div className="new-item-panel__type-row">
          <div className="new-item-panel__type-pills">
            <button
              type="button"
              className={`new-item-panel__type-pill${itemType === "note" ? " new-item-panel__type-pill--active" : ""}`}
              onClick={() => setItemType("note")}
            >
              <NoteIcon /> note
            </button>
            <button
              type="button"
              className={`new-item-panel__type-pill${itemType === "snippet" ? " new-item-panel__type-pill--active" : ""}`}
              onClick={() => setItemType("snippet")}
            >
              {"</>"} snippet
            </button>
          </div>
        </div>
      )}

      <div className="new-item-panel__body">
        {itemType === "note" ? (
          <div className="new-item-panel__editor-wrap">
            <MarkdownToolbar onFormat={applyFormat} />
            <textarea
              ref={textareaRef}
              className="new-item-panel__textarea"
              placeholder="start writing…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleBodyKeyDown}
            />
          </div>
        ) : (
          <div className="new-item-panel__snippet-wrap">
            <div className="new-item-panel__lang-row">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`new-item-panel__lang-pill${lang === l ? " new-item-panel__lang-pill--active" : ""}`}
                  onClick={() => setLang(l)}
                >
                  {l}
                </button>
              ))}
            </div>
            <textarea
              ref={codeRef}
              className="new-item-panel__textarea new-item-panel__textarea--code"
              placeholder="paste your snippet here…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={insertTabOnTab}
            />
            <textarea
              className="new-item-panel__textarea new-item-panel__textarea--snippet-note"
              placeholder="notes (caveats, usage context…)"
              value={snippetNote}
              onChange={(e) => setSnippetNote(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default NewItemPanel;
