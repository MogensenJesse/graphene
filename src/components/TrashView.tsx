// src/components/TrashView.tsx
import { useEffect, useState } from "react";
import { formatDate, getFolderPath } from "../lib/utils";
import type { Folder, Item } from "../types";
import { TrashIcon } from "./Icon";

interface TrashViewProps {
  trashed: Item[];
  folders: Folder[];
  onRestore: (id: string) => void;
  onEmpty: () => void;
}

function TrashView({ trashed, folders, onRestore, onEmpty }: TrashViewProps) {
  const [confirming, setConfirming] = useState(false);

  // Nothing left to empty: drop a pending confirmation
  useEffect(() => {
    if (trashed.length === 0) setConfirming(false);
  }, [trashed.length]);

  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  const count = `${trashed.length} ${trashed.length === 1 ? "item" : "items"}`;

  return (
    <div className="trash-view">
      <div className="item-header" data-tauri-drag-region>
        <div className="item-header__title-row">
          <h2 className="trash-view__title">Trash</h2>
        </div>
        <div className="item-header__meta">
          <span className="trash-view__count">{count}</span>
          {trashed.length > 0 && (
            <div className="item-header__actions">
              {confirming ? (
                <>
                  <button
                    type="button"
                    className="item-header__btn item-header__btn--danger"
                    onClick={() => {
                      onEmpty();
                      setConfirming(false);
                    }}
                    title="Permanently delete everything in the trash"
                  >
                    delete {count} forever?
                  </button>
                  <button
                    type="button"
                    className="item-header__btn item-header__btn--quiet"
                    onClick={() => setConfirming(false)}
                  >
                    cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="item-header__btn item-header__btn--danger"
                  onClick={() => setConfirming(true)}
                >
                  <TrashIcon />
                  empty trash
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="trash-view__body">
        {trashed.length === 0 ? (
          <p className="trash-view__empty">trash is empty</p>
        ) : (
          <ul className="trash-view__list">
            {trashed.map((item) => (
              <li key={item.id} className="trash-view__row">
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
