// src/components/ItemHeader.tsx
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { formatDate } from "../lib/utils";
import type { Folder } from "../types";
import FolderPicker from "./FolderPicker";

interface ItemHeaderProps {
  title: string;
  // Read view commits a rename on blur/Enter; with liveTitle (the editor) it fires on every keystroke
  onTitleChange: (title: string) => void;
  liveTitle?: boolean;
  folders: Folder[];
  folderId: string | null;
  onFolderChange: (id: string | null) => void;
  badge?: ReactNode;
  updatedAt?: string;
  isDirty?: boolean;
  actions?: ReactNode;
}

function ItemHeader({
  title,
  onTitleChange,
  liveTitle = false,
  folders,
  folderId,
  onFolderChange,
  badge,
  updatedAt,
  isDirty = false,
  actions,
}: ItemHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  // True while no rename is in progress; stops a rename finishing twice (Enter, then the blur on unmount)
  const finishedRef = useRef(true);

  const startEditing = useCallback(() => {
    if (!finishedRef.current) return;
    finishedRef.current = false;
    setDraft(title);
    setEditing(true);
  }, [title]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // F2 renames from anywhere, as in a file manager
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        startEditing();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [startEditing]);

  const finish = (apply: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setEditing(false);
    if (apply && !liveTitle) {
      const next = draft.trim();
      if (next && next !== title) onTitleChange(next);
    }
  };

  return (
    <div className="item-header" data-tauri-drag-region>
      <h2
        className={`item-header__heading${editing ? " item-header__heading--editing" : ""}`}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="item-header__title-input"
            type="text"
            placeholder="untitled"
            aria-label="Title"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (liveTitle) onTitleChange(e.target.value);
            }}
            onBlur={() => finish(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") finish(true);
              if (e.key === "Escape") {
                // Keep the editor's own Escape handler from also closing the whole editor
                e.stopPropagation();
                finish(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={`item-header__title${title ? "" : " item-header__title--placeholder"}`}
            onClick={startEditing}
            title="Rename (F2)"
          >
            {title || "untitled"}
          </button>
        )}
      </h2>
      {isDirty && (
        <span
          className="item-header__dirty-dot"
          role="img"
          aria-label="unsaved changes"
          title="unsaved changes"
        />
      )}

      <FolderPicker
        folders={folders}
        value={folderId}
        onChange={onFolderChange}
      />
      {badge}
      <div className="item-header__spacer" data-tauri-drag-region />
      {updatedAt && (
        <span
          className="item-header__date"
          title={new Date(updatedAt).toLocaleString()}
        >
          {formatDate(updatedAt)}
        </span>
      )}
      {actions}
    </div>
  );
}

export default ItemHeader;
