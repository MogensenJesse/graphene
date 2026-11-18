// src/components/ui/MoreButton.tsx
import type { MenuEntry } from "./ContextMenu";
import { useContextMenu } from "./ContextMenuProvider";
import { EllipsisIcon } from "./Icon";
import Tooltip from "./Tooltip";

/** The "…" button of the item header: opens `entries` as a menu right under itself. */
function MoreButton({ entries }: { entries: MenuEntry[] }) {
  const { openAt } = useContextMenu();
  return (
    <Tooltip label="More">
      <button
        type="button"
        className="item-header__btn item-header__btn--icon"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          openAt(r.left, r.bottom + 2, entries);
        }}
        aria-label="More actions"
        aria-haspopup="menu"
      >
        <EllipsisIcon />
      </button>
    </Tooltip>
  );
}

export default MoreButton;
