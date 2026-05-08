// src/components/ItemRow.tsx
import { formatDate } from "../lib/utils";
import type { Item } from "../types";

interface ItemRowProps {
  item: Item;
  isSelected: boolean;
  isDragOver?: boolean;
  onSelect: (id: string) => void;
  onPointerDown: (e: React.PointerEvent, id: string, title: string) => void;
  style?: React.CSSProperties;
}

function ItemRow({
  item,
  isSelected,
  isDragOver,
  onSelect,
  onPointerDown,
  style,
}: ItemRowProps) {
  return (
    <div
      className={`item-row${isSelected ? " item-row--selected" : ""}${isDragOver ? " item-row--drag-over" : ""}`}
      style={style}
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
          {item.type === "note" ? "📝" : "</>"}
        </span>
        <span className="item-row__title">{item.title}</span>
        <span className="item-row__date">{formatDate(item.updatedAt)}</span>
      </div>
    </div>
  );
}

export default ItemRow;
