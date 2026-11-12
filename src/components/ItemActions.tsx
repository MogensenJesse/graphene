// src/components/ItemActions.tsx
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import { EditIcon, TrashIcon } from "./Icon";

interface ItemActionsProps {
  itemId: string;
  noun: "note" | "snippet";
  onEdit: () => void;
  onDelete: (id: string) => void;
  // False while a folder is selected, so the Del key goes to the folder instead
  deleteKeyEnabled: boolean;
}

// Edit + two-step delete for the read view; shared by notes and snippets
function ItemActions({
  itemId,
  noun,
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
      <button
        type="button"
        className="item-header__btn"
        onClick={onEdit}
        title="Edit (Ctrl+E)"
        aria-label={`Edit ${noun}`}
      >
        <EditIcon />
        edit
      </button>
      {confirming ? (
        <>
          <button
            type="button"
            className="item-header__btn item-header__btn--danger"
            onClick={requestDelete}
            title="Confirm delete"
            aria-label={`Confirm delete ${noun}`}
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
          title="Delete (Del)"
          aria-label={`Delete ${noun}`}
        >
          <TrashIcon />
          delete
        </button>
      )}
    </div>
  );
}

export default ItemActions;
