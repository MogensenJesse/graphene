// src/components/NoteDetail.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import { formatDate, getFolderPath } from "../lib/utils";
import type { Folder, NoteItem } from "../types";

const REMARK_PLUGINS = [remarkGfm];

interface NoteDetailProps {
  note: NoteItem;
  folders: Folder[];
  onEdit: () => void;
  onDelete: (id: string) => void;
}

function NoteDetail({ note, folders, onEdit, onDelete }: NoteDetailProps) {
  const { confirming, startConfirm, cancelConfirm } = useDeleteConfirm(note.id);

  const handleDeleteClick = () => {
    if (confirming) {
      onDelete(note.id);
    } else {
      startConfirm();
    }
  };

  const folderPath = getFolderPath(folders, note.folderId);

  return (
    <div className="note-detail">
      <div className="note-detail__header" data-tauri-drag-region>
        <div className="note-detail__header-left">
          <h2 className="note-detail__title">{note.title}</h2>
          <div className="note-detail__meta">
            {folderPath.length > 0 && (
              <span className="note-detail__folder-path">
                {folderPath.join(" › ")}
              </span>
            )}
            <span className="note-detail__date">
              {formatDate(note.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="note-detail__body">
        <div className="note-detail__markdown">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
            {note.body}
          </ReactMarkdown>
        </div>
      </div>

      <div className="note-detail__footer">
        <div className="note-detail__footer-left">
          <button
            type="button"
            className="note-detail__action-btn note-detail__action-btn--edit"
            onClick={onEdit}
            title="Edit note"
            aria-label="Edit note"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            edit
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                className="note-detail__action-btn note-detail__action-btn--confirm-delete"
                onClick={handleDeleteClick}
                title="Confirm delete"
                aria-label="Confirm delete note"
              >
                confirm?
              </button>
              <button
                type="button"
                className="note-detail__action-btn note-detail__action-btn--cancel-delete"
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
              className="note-detail__action-btn note-detail__action-btn--delete"
              onClick={handleDeleteClick}
              title="Delete note"
              aria-label="Delete note"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 3h8M5 3V2h2v1M9.5 3l-.5 7a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5L3 3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default NoteDetail;
