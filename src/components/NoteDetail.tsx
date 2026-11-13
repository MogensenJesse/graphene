// src/components/NoteDetail.tsx
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  MARKDOWN_COMPONENTS,
  REHYPE_PLUGINS,
  REMARK_PLUGINS,
} from "../lib/markdown";
import type { Folder, Item } from "../types";
import ItemActions from "./ItemActions";
import ItemHeader from "./ItemHeader";

interface NoteDetailProps {
  note: Item;
  folders: Folder[];
  onEdit: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  // False while a folder is selected, so the Del key goes to the folder instead
  deleteKeyEnabled: boolean;
}

function NoteDetail({
  note,
  folders,
  onEdit,
  onDelete,
  onRename,
  onMove,
  deleteKeyEnabled,
}: NoteDetailProps) {
  const markdownRef = useRef<HTMLDivElement>(null);

  // Ctrl+C with nothing selected copies the code when the note has exactly one code block.
  // Clicking the block's own copy button keeps the "copied" feedback in one place.
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
      const buttons =
        markdownRef.current?.querySelectorAll<HTMLButtonElement>(
          ".code-block__copy",
        );
      if (buttons?.length !== 1) return;
      e.preventDefault();
      buttons[0].click();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="note-detail">
      <ItemHeader
        title={note.title}
        onTitleChange={(title) => onRename(note.id, title)}
        folders={folders}
        folderId={note.folderId}
        onFolderChange={(folderId) => onMove(note.id, folderId)}
        updatedAt={note.updatedAt}
        actions={
          <ItemActions
            itemId={note.id}
            onEdit={onEdit}
            onDelete={onDelete}
            deleteKeyEnabled={deleteKeyEnabled}
          />
        }
      />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only shortcut, keyboard users have Ctrl+E and the Edit button. Double-click on empty space (not on text, so word-select still works) starts editing */}
      <div
        className="note-detail__body"
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) onEdit();
        }}
      >
        <div className="note-detail__markdown" ref={markdownRef}>
          <ReactMarkdown
            remarkPlugins={REMARK_PLUGINS}
            rehypePlugins={REHYPE_PLUGINS}
            components={MARKDOWN_COMPONENTS}
          >
            {note.body}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default NoteDetail;
