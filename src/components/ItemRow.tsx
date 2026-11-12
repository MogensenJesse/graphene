// src/components/ItemRow.tsx
import type { Item } from "../types";
import { NoteIcon } from "./Icon";

interface ItemRowProps {
  item: Item;
  isSelected: boolean;
  isDragOver?: boolean;
  isUnsaved?: boolean;
  onSelect: (id: string) => void;
  onPointerDown: (e: React.PointerEvent, id: string, title: string) => void;
  style?: React.CSSProperties;
}

function ItemRow({
  item,
  isSelected,
  isDragOver,
  isUnsaved,
  onSelect,
  onPointerDown,
  style,
}: ItemRowProps) {
  return (
    <div
      className={`item-row${isSelected ? " item-row--selected" : ""}${isDragOver ? " item-row--drag-over" : ""}`}
      style={style}
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
      <div className="item-row__top">
        <span
          className={`item-row__type-icon item-row__type-icon--${item.type}`}
          aria-hidden="true"
        >
          {item.type === "note" ? <NoteIcon /> : "</>"}
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
    </div>
  );
}

export default ItemRow;
