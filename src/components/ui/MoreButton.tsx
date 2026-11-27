// src/components/ui/MoreButton.tsx
import { pointBelow } from "../../lib/popoverBounds";
import Button from "./Button";
import type { MenuEntry } from "./ContextMenu";
import { useContextMenu } from "./ContextMenuProvider";
import { EllipsisIcon } from "./Icon";
import Tooltip from "./Tooltip";

/** The "…" button of the item header: opens `entries` as a menu right under itself. */
function MoreButton({ entries }: { entries: MenuEntry[] }) {
  const { openAt } = useContextMenu();
  return (
    <Tooltip label="More">
      <Button
        size="sm"
        iconOnly
        onClick={(e) => {
          openAt(...pointBelow(e.currentTarget), entries);
        }}
        aria-label="More actions"
        aria-haspopup="menu"
      >
        <EllipsisIcon />
      </Button>
    </Tooltip>
  );
}

export default MoreButton;
