// src/components/ItemRow.tsx
import { isCodeItem } from "../lib/utils";
import type { Item } from "../types";
import { CodeIcon, NoteIcon } from "./Icon";

interface ItemRowProps {
  item: Item;
  isSelected: boolean;
  isDragOver?: boolean;
  isUnsaved?: boolean;
  onSelect: (id: string) => void;
  onPointerDown: (e: React.PointerEvent, id: string, title: string) => void;
}

function ItemRow({
  item,
  isSelected,
  isDragOver,
  isUnsaved,
  onSelect,
  onPointerDown,
}: ItemRowProps) {
  return (
    <div
      className={`item-row${isSelected ? " item-row--selected" : ""}${isDragOver ? " item-row--drag-over" : ""}`}
      data-item-id={item.id}
      title={item.title}
      onPointerDown={(e) => onPointerDown(e, item.id, item.title)}
      onClick={() => onSelect(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(item.id);
      }}
      role="treeitem"
      aria-selected={isSelected}
    >
      <span className="item-row__type-icon" aria-hidden="true">
        {isCodeItem(item) ? <CodeIcon size={13} /> : <NoteIcon size={13} />}
      </span>
      <span className="item-row__title">{item.title}</span>
      {isUnsaved && (
        <span
          className="item-row__unsaved-dot"
          aria-label="unsaved changes"
          title="unsaved changes"
        />
      )}
    </div>
  );
}

export default ItemRow;
