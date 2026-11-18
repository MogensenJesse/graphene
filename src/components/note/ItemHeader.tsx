// src/components/note/ItemHeader.tsx
import { type ReactNode, useEffect, useState } from "react";
import { formatDate } from "../../lib/utils";
import type { Folder } from "../../types";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import { TextCursorInputIcon } from "../ui/Icon";
import InlineInput from "../ui/InlineInput";
import FolderPicker from "./FolderPicker";

interface ItemHeaderProps {
  title: string;
  // Read view commits a rename on blur/Enter; with liveTitle (the editor) it fires on every keystroke
  onTitleChange: (title: string) => void;
  liveTitle?: boolean;
  folders: Folder[];
  folderId: string | null;
  onFolderChange: (id: string | null) => void;
  badge?: ReactNode;
  updatedAt?: string;
  isDirty?: boolean;
  actions?: ReactNode;
  // Right-click menu of the bar, below its own "Rename"
  menuEntries?: MenuEntry[];
}

function ItemHeader({
  title,
  onTitleChange,
  liveTitle = false,
  folders,
  folderId,
  onFolderChange,
  badge,
  updatedAt,
  isDirty = false,
  actions,
  menuEntries = [],
}: ItemHeaderProps) {
  const { open } = useContextMenu();
  const [editing, setEditing] = useState(false);
  const startEditing = () => setEditing(true);

  // F2 renames from anywhere, as in a file manager
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setEditing(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; Rename has F2 and the title button
    <div
      className="item-header"
      data-tauri-drag-region
      onContextMenu={(e) =>
        open(e, [
          {
            label: "Rename",
            icon: <TextCursorInputIcon size={14} />,
            onSelect: startEditing,
          },
          ...(menuEntries.length ? ["separator" as const, ...menuEntries] : []),
        ])
      }
    >
      <h2
        className={`item-header__heading${editing ? " item-header__heading--editing" : ""}`}
      >
        {editing ? (
          <InlineInput
            initial={title}
            className="item-header__title-input"
            placeholder="untitled"
            ariaLabel="Title"
            onInput={liveTitle ? onTitleChange : undefined}
            onCommit={(text) => {
              setEditing(false);
              if (!liveTitle && text !== title) onTitleChange(text);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            className={`item-header__title${title ? "" : " item-header__title--placeholder"}`}
            onClick={startEditing}
            title="Rename (F2)"
          >
            {title || "untitled"}
          </button>
        )}
      </h2>
      {isDirty && (
        <span
          className="item-header__dirty-dot"
          role="img"
          aria-label="unsaved changes"
          title="unsaved changes"
        />
      )}

      <FolderPicker
        folders={folders}
        value={folderId}
        onChange={onFolderChange}
      />
      {badge}
      <div className="item-header__spacer" data-tauri-drag-region />
      {updatedAt && (
        <span
          className="item-header__date"
          title={new Date(updatedAt).toLocaleString()}
        >
          {formatDate(updatedAt)}
        </span>
      )}
      {actions}
    </div>
  );
}

export default ItemHeader;
