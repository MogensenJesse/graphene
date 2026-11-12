// src/components/NoteDetail.tsx
import ReactMarkdown from "react-markdown";
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from "../lib/markdown";
import type { Folder, NoteItem } from "../types";
import ItemActions from "./ItemActions";
import ItemHeader from "./ItemHeader";

interface NoteDetailProps {
  note: NoteItem;
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
            noun="note"
            onEdit={onEdit}
            onDelete={onDelete}
            deleteKeyEnabled={deleteKeyEnabled}
          />
        }
      />

      {/* Double-click on empty space (not on text, so word-select still works) starts editing */}
      <div
        className="note-detail__body"
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) onEdit();
        }}
      >
        <div className="note-detail__markdown">
          <ReactMarkdown
            remarkPlugins={REMARK_PLUGINS}
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
