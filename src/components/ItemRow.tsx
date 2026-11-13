// src/components/ItemRow.tsx
import { useEffect, useRef, useState } from "react";
import { isCodeItem } from "../lib/utils";
import type { Item } from "../types";
import { CodeIcon, NoteIcon } from "./Icon";

interface ItemRowProps {
  item: Item;
  isSelected: boolean;
  isDragOver?: boolean;
  isUnsaved?: boolean;
  isRenaming?: boolean;
  onSelect: (id: string) => void;
  onPointerDown: (e: React.PointerEvent, id: string, title: string) => void;
  onContextMenu: (e: React.MouseEvent, item: Item) => void;
  // The new title, or null when the rename was cancelled
  onRenameEnd: (id: string, title: string | null) => void;
}

function ItemRow({
  item,
  isSelected,
  isDragOver,
  isUnsaved,
  isRenaming,
  onSelect,
  onPointerDown,
  onContextMenu,
  onRenameEnd,
}: ItemRowProps) {
  const [draft, setDraft] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter commits and then the unmounting input may blur: report the rename only once
  const ended = useRef(false);

  useEffect(() => {
    if (!isRenaming) return;
    ended.current = false;
    setDraft(item.title);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isRenaming, item.title]);

  const end = (title: string | null) => {
    if (ended.current) return;
    ended.current = true;
    onRenameEnd(item.id, title);
  };

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the tree container is the single tab stop and takes the arrow keys, so rows are not focusable
    <div
      className={`item-row${isSelected ? " item-row--selected" : ""}${isDragOver ? " item-row--drag-over" : ""}`}
      data-item-id={item.id}
      title={item.title}
      // While renaming, the row must not start a drag, select, or hide the input's own context menu
      onPointerDown={
        isRenaming ? undefined : (e) => onPointerDown(e, item.id, item.title)
      }
      onClick={isRenaming ? undefined : () => onSelect(item.id)}
      onContextMenu={isRenaming ? undefined : (e) => onContextMenu(e, item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(item.id);
      }}
      role="treeitem"
      aria-selected={isSelected}
    >
      <span className="item-row__type-icon" aria-hidden="true">
        {isCodeItem(item) ? <CodeIcon size={13} /> : <NoteIcon size={13} />}
      </span>
      {isRenaming ? (
        <input
          ref={inputRef}
          className="item-row__rename-input"
          aria-label="Rename"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => end(draft.trim() || null)}
          onKeyDown={(e) => {
            // Typing must not reach the row's Enter/Space select or the tree's shortcuts
            e.stopPropagation();
            if (e.key === "Enter") end(draft.trim() || null);
            if (e.key === "Escape") end(null);
          }}
        />
      ) : (
        <span className="item-row__title">{item.title}</span>
      )}
      {isUnsaved && (
        <span
          className="item-row__unsaved-dot"
          role="img"
          aria-label="unsaved changes"
          title="unsaved changes"
        />
      )}
    </div>
  );
}

export default ItemRow;
