// src/components/dialogs/TrashView.tsx
import { useState } from "react";
import { useDeleteConfirm } from "../../hooks/useDeleteConfirm";
import { useEscape } from "../../hooks/useEscape";
import { isTextField } from "../../lib/textMenu";
import { formatDate, getFolderPath } from "../../lib/utils";
import type { Folder, Item } from "../../types";
import Button from "../ui/Button";
import ConfirmBar from "../ui/ConfirmBar";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import { TrashIcon, UndoIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

interface TrashViewProps {
  trashed: Item[];
  folders: Folder[];
  onRestore: (id: string) => void;
  /** Removes this one note's file from the trash for good (the question was asked here). */
  onDeleteForever: (id: string) => void;
  onEmpty: () => void;
  /** Escape: back to what was open before the Trash. */
  onLeave: () => void;
}

function TrashView({
  trashed,
  folders,
  onRestore,
  onDeleteForever,
  onEmpty,
  onLeave,
}: TrashViewProps) {
  // The key is the count: restoring a note while the question is up asks again with the new count
  const { confirming, arm, requestDelete, cancelConfirm } = useDeleteConfirm(
    String(trashed.length),
    onEmpty,
    false,
  );
  // The note whose "Delete forever" is waiting for a yes. One that has left the list (restored meanwhile) asks nothing.
  const [askId, setAskId] = useState<string | null>(null);
  const asking = trashed.find((item) => item.id === askId) ?? null;
  const { open } = useContextMenu();

  // Escape closes the question that is up first; with none, it leaves the view. A menu or a dialog (their own Escape runs first, in
  // the capture phase and stops the key), a field and anything that owns Escape keep it.
  useEscape(() => setAskId(null), { active: asking !== null });
  useEscape(onLeave, {
    when: () =>
      !confirming &&
      asking === null &&
      !isTextField(document.activeElement) &&
      !document.activeElement?.closest("[data-owns-escape]") &&
      !document.querySelector('[role="menu"], [aria-modal="true"]'),
  });

  const count = `${trashed.length} ${trashed.length === 1 ? "note" : "notes"}`;

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
                <Button variant="danger" size="sm" onClick={requestDelete}>
                  Delete {count} and unused images forever?
                </Button>
                <Button variant="quiet" size="sm" onClick={cancelConfirm}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={requestDelete}
                aria-label="Empty trash"
              >
                <TrashIcon />
                <span className="item-header__btn-label">Empty trash</span>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="trash-view__body" data-scrollbar>
        {trashed.length === 0 ? (
          <p className="trash-view__empty">Trash is empty</p>
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
                    {
                      label: "Delete forever…",
                      icon: <TrashIcon size={14} />,
                      danger: true,
                      onSelect: () => setAskId(item.id),
                    },
                    ...emptyEntries,
                  ])
                }
              >
                <div className="trash-view__row-main">
                  <div className="trash-view__info">
                    <span className="trash-view__row-title">
                      {item.title || "Untitled"}
                    </span>
                    <span className="trash-view__row-meta">
                      {getFolderPath(folders, item.folderId).join(" / ") ||
                        "No folder"}
                      {" · "}edited {formatDate(item.updatedAt)}
                    </span>
                  </div>
                  <Tooltip label="Remove it from the trash for good">
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => setAskId(item.id)}
                    >
                      Delete forever
                    </Button>
                  </Tooltip>
                  <Tooltip label="Put it back where it was">
                    <Button size="sm" onClick={() => onRestore(item.id)}>
                      Restore
                    </Button>
                  </Tooltip>
                </div>
                {asking?.id === item.id && (
                  <ConfirmBar
                    question={`Delete "${item.title || "Untitled"}" forever? It cannot be brought back.`}
                    confirmLabel="Delete forever"
                    onConfirm={() => {
                      setAskId(null);
                      onDeleteForever(item.id);
                    }}
                    onCancel={() => setAskId(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TrashView;
