// src/components/note/ItemActions.tsx
import { useEffect } from "react";
import { useLatest } from "../../hooks/useLatest";
import type { MenuEntry } from "../ui/ContextMenu";
import { EditIcon } from "../ui/Icon";
import MoreButton from "../ui/MoreButton";
import Tooltip from "../ui/Tooltip";
import CopyNoteButton from "./CopyNoteButton";

interface ItemActionsProps {
  itemId: string;
  // Markdown of the note, for the copy button
  body: string;
  onEdit: () => void;
  onDelete: (id: string) => void;
  // False while a folder is selected, so the Del key goes to the folder instead
  deleteKeyEnabled: boolean;
  // What the "…" button offers (duplicate, reveal, move to trash)
  moreEntries: MenuEntry[];
}

// Copy, "…" and Edit for the read view; Edit sits where Done sits in the editor. The Del key moves the
// note to the trash (the app shows an Undo for that)
function ItemActions({
  itemId,
  body,
  onEdit,
  onDelete,
  deleteKeyEnabled,
  moreEntries,
}: ItemActionsProps) {
  const remove = useLatest(() => onDelete(itemId));

  useEffect(() => {
    if (!deleteKeyEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" || e.repeat) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      // A dialog or an open menu owns the keyboard
      if (document.querySelector('[aria-modal="true"], [role="menu"]')) return;
      remove.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deleteKeyEnabled, remove]);

  return (
    <div className="item-header__actions">
      <CopyNoteButton text={body} />
      <MoreButton entries={moreEntries} />
      <Tooltip label="Edit" keys="Ctrl+E">
        <button
          type="button"
          className="item-header__btn"
          onClick={onEdit}
          aria-label="Edit item"
        >
          <EditIcon />
          <span className="item-header__btn-label">Edit</span>
        </button>
      </Tooltip>
    </div>
  );
}

export default ItemActions;
