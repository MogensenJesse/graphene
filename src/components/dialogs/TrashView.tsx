// src/components/dialogs/TrashView.tsx
import { useDeleteConfirm } from "../../hooks/useDeleteConfirm";
import { formatDate, getFolderPath } from "../../lib/utils";
import type { Folder, Item } from "../../types";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import { TrashIcon, UndoIcon } from "../ui/Icon";

interface TrashViewProps {
  trashed: Item[];
  folders: Folder[];
  onRestore: (id: string) => void;
  onEmpty: () => void;
}

function TrashView({ trashed, folders, onRestore, onEmpty }: TrashViewProps) {
  // The key is the count: restoring an item while the question is up asks again with the new count
  const { confirming, arm, requestDelete, cancelConfirm } = useDeleteConfirm(
    String(trashed.length),
    onEmpty,
    false,
  );
  const { open } = useContextMenu();

  const count = `${trashed.length} ${trashed.length === 1 ? "item" : "items"}`;

  // Emptying only asks for the confirmation, like the button does
  const emptyEntries: MenuEntry[] = [
    {
      label: "Empty trash…",
      icon: <TrashIcon size={14} />,
      danger: true,
      onSelect: () => arm(),
    },
  ];

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; every entry has a button elsewhere
    <div
      className="trash-view"
      onContextMenu={(e) => {
        if (trashed.length > 0) open(e, emptyEntries);
      }}
    >
      <div className="item-header" data-tauri-drag-region>
        <h2 className="trash-view__title">Trash</h2>
        <span className="trash-view__count">{count}</span>
        <div className="item-header__spacer" data-tauri-drag-region />
        {trashed.length > 0 && (
          <div className="item-header__actions">
            {confirming ? (
              <>
                <button
                  type="button"
                  className="item-header__btn item-header__btn--danger"
                  onClick={requestDelete}
                  title="Permanently delete everything in the trash, and the pictures no note links to"
                >
                  delete {count} and unused images forever?
                </button>
                <button
                  type="button"
                  className="item-header__btn item-header__btn--quiet"
                  onClick={cancelConfirm}
                >
                  cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="item-header__btn item-header__btn--danger"
                onClick={requestDelete}
                aria-label="Empty trash"
              >
                <TrashIcon />
                <span className="item-header__btn-label">empty trash</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="trash-view__body">
        {trashed.length === 0 ? (
          <p className="trash-view__empty">trash is empty</p>
        ) : (
          <ul className="trash-view__list">
            {trashed.map((item) => (
              <li
                key={item.id}
                className="trash-view__row"
                onContextMenu={(e) =>
                  open(e, [
                    {
                      label: "Restore",
                      icon: <UndoIcon size={14} />,
                      onSelect: () => onRestore(item.id),
                    },
                    "separator",
                    ...emptyEntries,
                  ])
                }
              >
                <div className="trash-view__info">
                  <span className="trash-view__row-title">
                    {item.title || "untitled"}
                  </span>
                  <span className="trash-view__row-meta">
                    {getFolderPath(folders, item.folderId).join(" / ") ||
                      "unfiled"}
                    {" · "}edited {formatDate(item.updatedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className="item-header__btn"
                  onClick={() => onRestore(item.id)}
                  title="Put it back where it was"
                >
                  restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TrashView;
