// src/components/sidebar/ItemRow.tsx
import { useMemo } from "react";
import { taskProgress } from "../../lib/tasks";
import { itemKind } from "../../lib/utils";
import type { Item } from "../../types";
import { KindIcon } from "../ui/Icon";
import InlineInput from "../ui/InlineInput";

interface ItemRowProps {
  item: Item;
  isSelected: boolean;
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
  isUnsaved,
  isRenaming,
  onSelect,
  onPointerDown,
  onContextMenu,
  onRenameEnd,
}: ItemRowProps) {
  const kind = itemKind(item);
  const progress = useMemo(
    () => (kind === "todo" ? taskProgress(item.body) : null),
    [kind, item.body],
  );

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the tree container is the single tab stop and takes the arrow keys, so rows are not focusable
    <div
      className={`item-row${isSelected ? " item-row--selected" : ""}`}
      data-item-id={item.id}
      data-sort-kind="item"
      data-sort-id={item.id}
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
        <KindIcon kind={kind} size={13} />
      </span>
      {isRenaming ? (
        <InlineInput
          initial={item.title}
          className="item-row__rename-input"
          ariaLabel="Rename"
          isolate
          onCommit={(title) => onRenameEnd(item.id, title)}
          onCancel={() => onRenameEnd(item.id, null)}
        />
      ) : (
        <span className="item-row__title">{item.title}</span>
      )}
      {progress && progress.total > 0 && (
        <span className="item-row__progress">
          {progress.done}/{progress.total}
        </span>
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
