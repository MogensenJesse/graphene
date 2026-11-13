// src/components/ItemActions.tsx
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import CopyNoteButton from "./CopyNoteButton";
import { EditIcon, TrashIcon } from "./Icon";

interface ItemActionsProps {
  itemId: string;
  // Markdown of the note, for the copy button
  body: string;
  onEdit: () => void;
  onDelete: (id: string) => void;
  // False while a folder is selected, so the Del key goes to the folder instead
  deleteKeyEnabled: boolean;
}

// Edit + two-step delete for the read view
function ItemActions({
  itemId,
  body,
  onEdit,
  onDelete,
  deleteKeyEnabled,
}: ItemActionsProps) {
  const { confirming, requestDelete, cancelConfirm } = useDeleteConfirm(
    itemId,
    () => onDelete(itemId),
    deleteKeyEnabled,
  );

  return (
    <div className="item-header__actions">
      <CopyNoteButton text={body} />
      <button
        type="button"
        className="item-header__btn"
        onClick={onEdit}
        title="Edit (Ctrl+E)"
        aria-label="Edit item"
      >
        <EditIcon />
        <span className="item-header__btn-label">edit</span>
      </button>
      {confirming ? (
        <>
          <button
            type="button"
            className="item-header__btn item-header__btn--danger"
            onClick={requestDelete}
            title="Confirm delete"
            aria-label="Confirm delete item"
          >
            confirm?
          </button>
          <button
            type="button"
            className="item-header__btn item-header__btn--quiet"
            onClick={cancelConfirm}
            title="Cancel delete"
            aria-label="Cancel delete"
          >
            cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className="item-header__btn item-header__btn--danger"
          onClick={requestDelete}
          title="Move to trash (Del)"
          aria-label="Delete item"
        >
          <TrashIcon />
          <span className="item-header__btn-label">delete</span>
        </button>
      )}
    </div>
  );
}

export default ItemActions;
