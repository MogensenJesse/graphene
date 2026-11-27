// src/components/sidebar/ItemRow.tsx
import { memo, useState } from "react";
import { perfRender } from "../../lib/perf";
import { IS_TOUCH } from "../../lib/platform";
import { pointBelow } from "../../lib/popoverBounds";
import { treeItemId } from "../../lib/treeNav";
import type { ItemKind } from "../../types";
import { EllipsisIcon, KindIcon } from "../ui/Icon";
import IconButton from "../ui/IconButton";
import InlineInput from "../ui/InlineInput";
import Tooltip from "../ui/Tooltip";

// A row is given exactly what it draws, as plain values (and functions that keep their identity), and is memoised: a change to a
// note's text, or to another row, renders nothing here. The note itself is looked up by id when a menu opens.
interface ItemRowProps {
  id: string;
  title: string;
  kind: ItemKind;
  isSelected: boolean;
  isUnsaved: boolean;
  isRenaming: boolean;
  /** How deep it sits in the tree (the top level is 1), for aria-level */
  level: number;
  onSelect: (id: string) => void;
  onPointerDown: (e: React.PointerEvent, id: string, title: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  // The new title, or null when the rename was cancelled
  onRenameEnd: (id: string, title: string | null) => void;
  /** The "…" button: opens the same menu as a right-click, at x, y (under the button) */
  onMore: (id: string, x: number, y: number) => void;
}

function ItemRow({
  id,
  title,
  kind,
  isSelected,
  isUnsaved,
  isRenaming,
  level,
  onSelect,
  onPointerDown,
  onContextMenu,
  onRenameEnd,
  onMore,
}: ItemRowProps) {
  perfRender("ItemRow");
  // The "…" button is only drawn once the pointer has been over the row: thousands of rows would otherwise each carry its button
  // (about 5 more nodes a row, 100k at 20,000 notes). Until then the row only keeps the button's width free (a CSS pseudo-element).
  // A touch screen has no hover to wait for and shows the button at rest (`_Touch.scss`), so there every row has it from the start
  const [armed, setArmed] = useState(IS_TOUCH);

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the tree container is the single tab stop and takes the arrow keys, so rows are not focusable
    <div
      className={`item-row${isSelected ? " item-row--selected" : ""}${armed || isRenaming ? "" : " item-row--more-pending"}`}
      onPointerEnter={armed ? undefined : () => setArmed(true)}
      id={treeItemId({ kind: "item", id })}
      data-item-id={id}
      data-sort-kind="item"
      data-sort-id={id}
      title={title}
      // While renaming, the row must not start a drag, select, or hide the input's own context menu
      onPointerDown={
        isRenaming ? undefined : (e) => onPointerDown(e, id, title)
      }
      onClick={isRenaming ? undefined : () => onSelect(id)}
      onContextMenu={isRenaming ? undefined : (e) => onContextMenu(e, id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(id);
      }}
      role="treeitem"
      aria-level={level}
      aria-selected={isSelected}
      // The name is the title: the "…" button inside must not become part of it
      aria-label={isUnsaved ? `${title}, unsaved changes` : title}
    >
      <span className="item-row__type-icon" aria-hidden="true">
        <KindIcon kind={kind} size={13} />
      </span>
      {isRenaming ? (
        <InlineInput
          initial={title}
          className="item-row__rename-input"
          ariaLabel="Rename"
          isolate
          onCommit={(next) => onRenameEnd(id, next)}
          onCancel={() => onRenameEnd(id, null)}
        />
      ) : (
        <span className="item-row__title">{title}</span>
      )}
      {isUnsaved && (
        <Tooltip label="Unsaved changes">
          <span
            className="item-row__unsaved-dot"
            role="img"
            aria-label="Unsaved changes"
          />
        </Tooltip>
      )}
      {armed && !isRenaming && (
        // Shown by the row's hover (CSS only: no state here). The row is the drag handle and selects on click, so this button keeps
        // the press and the keys to itself; it is not a tab stop (a tab stop on every row would be hundreds): the tree's menu key
        // opens the same menu
        <IconButton
          size="sm"
          className="item-row__more"
          tabIndex={-1}
          aria-label={`Options for ${title}`}
          aria-haspopup="menu"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMore(id, ...pointBelow(e.currentTarget));
          }}
        >
          <EllipsisIcon size={13} />
        </IconButton>
      )}
    </div>
  );
}

export default memo(ItemRow);
