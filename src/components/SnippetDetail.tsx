// src/components/SnippetDetail.tsx
import { useEffect } from "react";
import { useClipboard } from "../hooks/useClipboard";
import { LANG_COLORS } from "../types";
import type { Folder, SnippetItem } from "../types";
import CodeBlock from "./CodeBlock";
import ItemActions from "./ItemActions";
import ItemHeader from "./ItemHeader";

interface SnippetDetailProps {
  snippet: SnippetItem;
  folders: Folder[];
  onEdit: () => void;
  onDelete: (id: string) => void;
  onCopied: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  // False while a folder is selected, so the Del key goes to the folder instead
  deleteKeyEnabled: boolean;
}

function SnippetDetail({
  snippet,
  folders,
  onEdit,
  onDelete,
  onCopied,
  onRename,
  onMove,
  deleteKeyEnabled,
}: SnippetDetailProps) {
  const { copy, copied } = useClipboard();

  const langStyle = LANG_COLORS[snippet.lang] ?? {
    bg: "var(--color-background-secondary)",
    color: "var(--color-text-secondary)",
  };

  // Copy the exact source, not the rendered text
  const handleCopy = async () => {
    await copy(snippet.code);
    onCopied(snippet.id);
  };

  // Ctrl+C copies the snippet unless the user is typing or has text selected (then it is a normal copy)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key !== "c") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      handleCopy();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="snippet-detail">
      <ItemHeader
        title={snippet.title}
        onTitleChange={(title) => onRename(snippet.id, title)}
        folders={folders}
        folderId={snippet.folderId}
        onFolderChange={(folderId) => onMove(snippet.id, folderId)}
        badge={
          <span
            className="item-header__badge"
            style={{ background: langStyle.bg, color: langStyle.color }}
          >
            {snippet.lang}
          </span>
        }
        updatedAt={snippet.updatedAt}
        actions={
          <ItemActions
            itemId={snippet.id}
            noun="snippet"
            onEdit={onEdit}
            onDelete={onDelete}
            deleteKeyEnabled={deleteKeyEnabled}
          />
        }
      />

      <div className="snippet-detail__body">
        <div>
          <div className="snippet-detail__section-label">code</div>
          <CodeBlock copied={copied} onCopy={handleCopy}>
            {snippet.code}
          </CodeBlock>
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
    </div>
  );
}

export default SnippetDetail;
