// src/components/FolderRow.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { compareNames, readCollapsed, setFolderCollapsed } from "../lib/utils";
import type { Folder, Item } from "../types";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisIcon,
  PlusIcon,
} from "./Icon";
import ItemRow from "./ItemRow";

interface FolderRowProps {
  folder: Folder;
  allFolders: Folder[];
  items: Item[];
  selectedFolderId: string | null;
  selectedId: string | null;
  unsavedItemId: string | null;
  // undefined = no drag active / not over this folder; null = unfiled zone matched; string = folder id matched
  dragOverId: string | null | undefined;
  // While searching/filtering: hide folders with no match and show matches expanded
  forceExpand: boolean;
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
  unsavedItemId,
  dragOverId,
  forceExpand,
  onSelect,
  onSelectItem,
  onItemPointerDown,
  onAddSubfolder,
  onRename,
  onDelete,
}: FolderRowProps) {
  // ponytail: collapsed state is keyed by folder path, so a renamed folder comes back expanded
  const [isExpanded, setIsExpanded] = useState(
    () => !readCollapsed().has(folder.id),
  );
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null);

  const children = useMemo(
    () =>
      allFolders
        .filter((f) => f.parentId === folder.id)
        .sort((a, b) => compareNames(a.name, b.name)),
    [allFolders, folder.id],
  );
  const myItems = useMemo(
    () => items.filter((i) => i.folderId === folder.id),
    [items, folder.id],
  );
  // Any match in this folder or below it (folder ids are paths, so descendants share the prefix)
  const hasMatch = useMemo(
    () =>
      items.some(
        (i) =>
          i.folderId === folder.id || i.folderId?.startsWith(`${folder.id}/`),
      ),
    [items, folder.id],
  );
  const hasContents = children.length > 0 || myItems.length > 0;
  const isSelected = selectedFolderId === folder.id;
  const isDragOver = dragOverId === folder.id;
  const expanded = forceExpand || isExpanded;

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

  useClickOutside(menuRef, showMenu, () => setShowMenu(false));

  if (forceExpand && !hasMatch) return null;

  const setExpanded = (value: boolean) => {
    setIsExpanded(value);
    setFolderCollapsed(folder.id, !value);
  };

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
    setExpanded(true);
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
        role="treeitem"
        aria-selected={isSelected}
      >
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
            aria-expanded={hasContents ? expanded : undefined}
            onClick={() => {
              onSelect(folder.id);
              setExpanded(!isExpanded);
            }}
          >
            <span className="folder-row__label">{folder.name}</span>
            {hasContents && (
              <span className="folder-row__chevron" aria-hidden="true">
                {expanded ? (
                  <ChevronDownIcon size={12} />
                ) : (
                  <ChevronRightIcon size={12} />
                )}
              </span>
            )}
          </button>
        )}

        <div
          className={`folder-row__actions${showMenu ? " folder-row__actions--open" : ""}`}
        >
          <button
            type="button"
            className="folder-row__action-btn"
            onClick={() => setShowAddChild((v) => !v)}
            aria-label={`Add subfolder to ${folder.name}`}
            title="Add subfolder"
          >
            <PlusIcon size={13} />
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
              <EllipsisIcon size={13} />
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

      {((expanded && hasContents) || showAddChild) && (
        <div className="folder-row__children">
          {showAddChild && (
            <div className="folder-row__add-child">
              <input
                ref={childInputRef}
                className="folder-row__rename-input"
                placeholder="Subfolder name…"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                onBlur={handleAddChildConfirm}
                onKeyDown={handleAddChildKeyDown}
              />
            </div>
          )}
          {expanded &&
            children.map((child) => (
              <FolderRow
                key={child.id}
                folder={child}
                allFolders={allFolders}
                items={items}
                selectedFolderId={selectedFolderId}
                selectedId={selectedId}
                unsavedItemId={unsavedItemId}
                dragOverId={dragOverId}
                forceExpand={forceExpand}
                onSelect={onSelect}
                onSelectItem={onSelectItem}
                onItemPointerDown={onItemPointerDown}
                onAddSubfolder={onAddSubfolder}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          {expanded &&
            myItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                isUnsaved={unsavedItemId === item.id}
                onSelect={onSelectItem}
                onPointerDown={onItemPointerDown}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default FolderRow;
