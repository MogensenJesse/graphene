// src/components/NewItemPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { AddNoteFields, AddSnippetFields } from "../hooks/useItems";
import { useMarkdownFormat } from "../hooks/useMarkdownFormat";
import type { Folder, NoteItem, SnippetItem } from "../types";
import { LANGUAGES } from "../types";
import FolderPicker from "./FolderPicker";
import MarkdownToolbar from "./MarkdownToolbar";

type Lang = (typeof LANGUAGES)[number];

const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

interface NewItemPanelProps {
  folders: Folder[];
  initialNote?: NoteItem;
  initialSnippet?: SnippetItem;
  defaultType?: "note" | "snippet";
  onSaveNote: (fields: AddNoteFields) => void;
  onSaveSnippet: (fields: AddSnippetFields) => void;
  onAutoSaveNote?: (fields: AddNoteFields) => void;
  onAutoSaveSnippet?: (fields: AddSnippetFields) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onCancel: () => void;
}

function NewItemPanel({
  folders,
  initialNote,
  initialSnippet,
  defaultType = "note",
  onSaveNote,
  onSaveSnippet,
  onAutoSaveNote,
  onAutoSaveSnippet,
  onDirtyChange,
  onCancel,
}: NewItemPanelProps) {
  const isEditing = !!(initialNote || initialSnippet);
  const [itemType, setItemType] = useState<"note" | "snippet">(
    initialSnippet ? "snippet" : isEditing ? "note" : defaultType,
  );
  const [title, setTitle] = useState(
    initialNote?.title ?? initialSnippet?.title ?? "",
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [body, setBody] = useState(initialNote?.body ?? "");
  const [mdMode, setMdMode] = useState(false);
  const [lang, setLang] = useState<Lang>(initialSnippet?.lang ?? "JS");
  const [code, setCode] = useState(initialSnippet?.code ?? "");
  const [snippetNote, setSnippetNote] = useState(initialSnippet?.note ?? "");
  const [folderId, setFolderId] = useState<string | null>(
    initialNote?.folderId ?? initialSnippet?.folderId ?? null,
  );

  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const applyFormat = useMarkdownFormat(textareaRef, body, setBody);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  const isDirty = useMemo(() => {
    if (initialNote) {
      return (
        title !== initialNote.title ||
        body !== initialNote.body ||
        folderId !== initialNote.folderId
      );
    }
    if (initialSnippet) {
      return (
        title !== initialSnippet.title ||
        code !== initialSnippet.code ||
        lang !== initialSnippet.lang ||
        snippetNote !== initialSnippet.note ||
        folderId !== initialSnippet.folderId
      );
    }
    return title.length > 0 || body.length > 0 || code.length > 0;
  }, [
    title,
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

  const handleSave = useCallback(() => {
    const resolvedTitle = title.trim() || "untitled";
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
    title,
    body,
    lang,
    code,
    snippetNote,
    folderId,
    onSaveNote,
    onSaveSnippet,
  ]);

  const handleAutoSave = useCallback(() => {
    const resolvedTitle = title.trim() || "untitled";
    if (itemType === "note" && onAutoSaveNote) {
      onAutoSaveNote({ title: resolvedTitle, body, folderId });
    } else if (itemType === "snippet" && onAutoSaveSnippet) {
      onAutoSaveSnippet({
        title: resolvedTitle,
        lang,
        code,
        note: snippetNote,
        folderId,
      });
    } else {
      handleSave();
    }
  }, [
    itemType,
    title,
    body,
    lang,
    code,
    snippetNote,
    folderId,
    onAutoSaveNote,
    onAutoSaveSnippet,
    handleSave,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleAutoSave();
      }
      if (
        e.key === "Escape" &&
        document.activeElement !== titleInputRef.current
      ) {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleAutoSave, onCancel]);

  return (
    <div className="new-item-panel">
      <div className="new-item-panel__header">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="new-item-panel__title-input"
            type="text"
            placeholder="untitled"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                setEditingTitle(false);
              }
            }}
          />
        ) : (
          <div className="new-item-panel__title-row">
            <button
              type="button"
              className={`new-item-panel__title-display${!title ? " new-item-panel__title-display--placeholder" : ""}`}
              onClick={() => setEditingTitle(true)}
            >
              {title || "untitled"}
            </button>
            {isDirty && (
              <span
                className="new-item-panel__dirty-dot"
                aria-label="unsaved changes"
                title="unsaved changes"
              />
            )}
          </div>
        )}

        {!isEditing && (
          <div className="new-item-panel__type-row">
            <div className="new-item-panel__type-pills">
              <button
                type="button"
                className={`new-item-panel__type-pill${itemType === "note" ? " new-item-panel__type-pill--active" : ""}`}
                onClick={() => setItemType("note")}
              >
                📝 note
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
      </div>

      <div className="new-item-panel__body">
        {itemType === "note" ? (
          <div className="new-item-panel__editor-wrap">
            <div className="new-item-panel__md-toggle-wrap">
              <button
                type="button"
                className={`new-item-panel__md-toggle${mdMode ? " new-item-panel__md-toggle--active" : ""}`}
                onClick={() => setMdMode((v) => !v)}
                aria-label={
                  mdMode ? "Switch to plain text" : "Switch to markdown preview"
                }
              >
                {mdMode ? "edit" : "preview"}
              </button>
            </div>
            {mdMode ? (
              <div className="new-item-panel__preview">
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                  {body}
                </ReactMarkdown>
              </div>
            ) : (
              <>
                <MarkdownToolbar onFormat={applyFormat} />
                <textarea
                  ref={textareaRef}
                  className="new-item-panel__textarea"
                  placeholder="start writing…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </>
            )}
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
              className="new-item-panel__textarea new-item-panel__textarea--code"
              placeholder="paste your snippet here…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {isEditing && (
              <textarea
                className="new-item-panel__textarea new-item-panel__textarea--snippet-note"
                placeholder="notes (caveats, usage context…)"
                value={snippetNote}
                onChange={(e) => setSnippetNote(e.target.value)}
              />
            )}
          </div>
        )}
      </div>

      <div className="new-item-panel__footer">
        <FolderPicker
          folders={folders}
          value={folderId}
          onChange={setFolderId}
        />
        <button
          type="button"
          className="new-item-panel__btn new-item-panel__btn--cancel"
          onClick={onCancel}
        >
          cancel
        </button>
        <button
          type="button"
          className="new-item-panel__btn new-item-panel__btn--save"
          onClick={handleSave}
        >
          {isEditing ? "save changes" : "save"}
        </button>
      </div>
    </div>
  );
}

export default NewItemPanel;
