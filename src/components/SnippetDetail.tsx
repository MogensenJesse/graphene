// src/components/SnippetDetail.tsx
import { useClipboard } from "../hooks/useClipboard";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import { formatDate, getFolderPath } from "../lib/utils";
import { LANG_COLORS } from "../types";
import type { Folder, SnippetItem } from "../types";

interface SnippetDetailProps {
  snippet: SnippetItem;
  folders: Folder[];
  onEdit: () => void;
  onDelete: (id: string) => void;
  onCopied: (id: string) => void;
}

function SnippetDetail({
  snippet,
  folders,
  onEdit,
  onDelete,
  onCopied,
}: SnippetDetailProps) {
  const { copy, copied } = useClipboard();
  const { confirming, startConfirm, cancelConfirm } = useDeleteConfirm(
    snippet.id,
  );

  const langStyle = LANG_COLORS[snippet.lang] ?? {
    bg: "var(--color-background-secondary)",
    color: "var(--color-text-secondary)",
  };

  const handleCopy = async () => {
    await copy(snippet.code);
    onCopied(snippet.id);
  };

  const handleDeleteClick = () => {
    if (confirming) {
      onDelete(snippet.id);
    } else {
      startConfirm();
    }
  };

  const folderPath = getFolderPath(folders, snippet.folderId);

  return (
    <div className="snippet-detail">
      <div className="snippet-detail__header" data-tauri-drag-region>
        <div className="snippet-detail__header-left">
          <h2 className="snippet-detail__title">{snippet.title}</h2>
          <div className="snippet-detail__meta">
            {folderPath.length > 0 && (
              <span className="snippet-detail__folder-path">
                {folderPath.join(" › ")}
              </span>
            )}
            <span
              className="snippet-detail__lang-badge"
              style={{ background: langStyle.bg, color: langStyle.color }}
            >
              {snippet.lang}
            </span>
            <span className="snippet-detail__date">
              {formatDate(snippet.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="snippet-detail__body">
        <div>
          <div className="snippet-detail__section-label">code</div>
          <pre className="snippet-detail__code-block">{snippet.code}</pre>
        </div>

        {snippet.note && (
          <div>
            <div className="snippet-detail__section-label">notes</div>
            <p className="snippet-detail__notes">{snippet.note}</p>
          </div>
        )}

        <div className="snippet-detail__copy-count">
          <span aria-hidden="true">⊕</span> copied {snippet.copies}×
        </div>
      </div>

      <div className="snippet-detail__footer">
        <div className="snippet-detail__footer-left">
          <button
            type="button"
            className="snippet-detail__action-btn snippet-detail__action-btn--edit"
            onClick={onEdit}
            title="Edit snippet"
            aria-label="Edit snippet"
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
                className="snippet-detail__action-btn snippet-detail__action-btn--confirm-delete"
                onClick={handleDeleteClick}
                title="Confirm delete"
                aria-label="Confirm delete snippet"
              >
                confirm?
              </button>
              <button
                type="button"
                className="snippet-detail__action-btn snippet-detail__action-btn--cancel-delete"
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
              className="snippet-detail__action-btn snippet-detail__action-btn--delete"
              onClick={handleDeleteClick}
              title="Delete snippet"
              aria-label="Delete snippet"
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
        <button
          type="button"
          className={`snippet-detail__copy-btn${copied ? " snippet-detail__copy-btn--copied" : ""}`}
          onClick={handleCopy}
          aria-label="Copy snippet code"
        >
          {copied ? (
            <>
              <span aria-hidden="true">✓</span> copied!
            </>
          ) : (
            <>
              <span aria-hidden="true">⊕</span> copy snippet
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default SnippetDetail;
