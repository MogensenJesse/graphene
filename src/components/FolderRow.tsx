// src/components/FolderRow.tsx
import { useEffect, useRef, useState } from "react";
import type { Folder, Item } from "../types";
import ItemRow from "./ItemRow";

interface FolderRowProps {
  folder: Folder;
  allFolders: Folder[];
  items: Item[];
  selectedFolderId: string | null;
  selectedId: string | null;
  // undefined = no drag active / not over this folder; null = unfiled zone matched; string = folder id matched
  dragOverId: string | null | undefined;
  depth: number;
  onSelect: (id: string | null) => void;
  onSelectItem: (id: string) => void;
  onItemPointerDown: (
    e: React.PointerEvent,
    itemId: string,
    label: string,
  ) => void;
  onAddSubfolder: (parentId: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function FolderRow({
  folder,
  allFolders,
  items,
  selectedFolderId,
  selectedId,
  dragOverId,
  depth,
  onSelect,
  onSelectItem,
  onItemPointerDown,
  onAddSubfolder,
  onRename,
  onDelete,
}: FolderRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null);

  const children = allFolders.filter((f) => f.parentId === folder.id);
  const myItems = items.filter((i) => i.folderId === folder.id);
  const hasContents = children.length > 0 || myItems.length > 0;
  const isSelected = selectedFolderId === folder.id;
  const isDragOver = dragOverId === folder.id;

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (showAddChild && childInputRef.current) {
      childInputRef.current.focus();
    }
  }, [showAddChild]);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const handleRenameConfirm = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      onRename(folder.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleRenameConfirm();
    if (e.key === "Escape") {
      setRenameValue(folder.name);
      setIsRenaming(false);
    }
  };

  const handleAddChildConfirm = () => {
    const trimmed = childName.trim();
    if (trimmed) onAddSubfolder(folder.id, trimmed);
    setChildName("");
    setShowAddChild(false);
    setIsExpanded(true);
  };

  const handleAddChildKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddChildConfirm();
    if (e.key === "Escape") {
      setChildName("");
      setShowAddChild(false);
    }
  };

  return (
    // data-folder-drop-id marks this group as a drop target for the pointer-event DnD system
    <div className="folder-row__group" data-folder-drop-id={folder.id}>
      <div
        className={`folder-row${isSelected ? " folder-row--selected" : ""}${isDragOver ? " folder-row--drag-over" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        role="treeitem"
        aria-selected={isSelected}
      >
        <button
          type="button"
          className="folder-row__chevron"
          onClick={() => setIsExpanded((v) => !v)}
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          tabIndex={-1}
        >
          {hasContents ? (isExpanded ? "▾" : "▸") : ""}
        </button>

        <span className="folder-row__icon" aria-hidden="true">
          {isExpanded && hasContents ? "📂" : "📁"}
        </span>

        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="folder-row__rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={handleRenameKeyDown}
          />
        ) : (
          <button
            type="button"
            className="folder-row__name"
            onClick={() => onSelect(folder.id)}
          >
            {folder.name}
          </button>
        )}

        <div className="folder-row__actions">
          <button
            type="button"
            className="folder-row__action-btn"
            onClick={() => setShowAddChild((v) => !v)}
            aria-label={`Add subfolder to ${folder.name}`}
            title="Add subfolder"
          >
            +
          </button>
          <div className="folder-row__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="folder-row__action-btn"
              onClick={() => setShowMenu((v) => !v)}
              aria-label="Folder options"
              aria-haspopup="true"
              aria-expanded={showMenu}
            >
              ···
            </button>
            {showMenu && (
              <div className="folder-row__dropdown" role="menu">
                <button
                  type="button"
                  className="folder-row__dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false);
                    setRenameValue(folder.name);
                    setIsRenaming(true);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="folder-row__dropdown-item folder-row__dropdown-item--danger"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(folder.id);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddChild && (
        <div
          className="folder-row__add-child"
          style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
        >
          <input
            ref={childInputRef}
            className="folder-row__rename-input"
            placeholder="subfolder name…"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onBlur={handleAddChildConfirm}
            onKeyDown={handleAddChildKeyDown}
          />
        </div>
      )}

      {isExpanded && (
        <>
          {children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              allFolders={allFolders}
              items={items}
              selectedFolderId={selectedFolderId}
              selectedId={selectedId}
              dragOverId={dragOverId}
              depth={depth + 1}
              onSelect={onSelect}
              onSelectItem={onSelectItem}
              onItemPointerDown={onItemPointerDown}
              onAddSubfolder={onAddSubfolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
          {myItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              onSelect={onSelectItem}
              onPointerDown={onItemPointerDown}
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default FolderRow;
