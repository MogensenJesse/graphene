// src/components/FolderRow.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { compareNames, readCollapsed, setFolderCollapsed } from "../lib/utils";
import type { Folder, Item } from "../types";
import type { MenuEntry } from "./ContextMenu";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FolderPlusIcon,
  PlusIcon,
  TextCursorInputIcon,
  TrashIcon,
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
  renamingItemId: string | null;
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
  onNew: (kind: "note" | "code", folderId: string) => void;
  onReveal: (folderId: string) => void;
  onOpenMenu: (x: number, y: number, entries: MenuEntry[]) => void;
  onItemContextMenu: (e: React.MouseEvent, item: Item) => void;
  onItemRenameEnd: (id: string, title: string | null) => void;
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
  renamingItemId,
  onSelect,
  onSelectItem,
  onItemPointerDown,
  onAddSubfolder,
  onRename,
  onDelete,
  onNew,
  onReveal,
  onOpenMenu,
  onItemContextMenu,
  onItemRenameEnd,
}: FolderRowProps) {
  // ponytail: collapsed state is keyed by folder path, so a renamed folder comes back expanded
  const [isExpanded, setIsExpanded] = useState(
    () => !readCollapsed().has(folder.id),
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState("");

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

  if (forceExpand && !hasMatch) return null;

  const setExpanded = (value: boolean) => {
    setIsExpanded(value);
    setFolderCollapsed(folder.id, !value);
  };

  const openMenu = (x: number, y: number) =>
    onOpenMenu(x, y, [
      {
        label: "New note here",
        icon: <PlusIcon size={14} />,
        onSelect: () => onNew("note", folder.id),
      },
      {
        label: "New code here",
        icon: <CodeIcon size={14} />,
        onSelect: () => onNew("code", folder.id),
      },
      {
        label: "New subfolder",
        icon: <FolderPlusIcon size={14} />,
        onSelect: () => setShowAddChild(true),
      },
      "separator",
      {
        label: "Rename",
        icon: <TextCursorInputIcon size={14} />,
        onSelect: () => {
          setRenameValue(folder.name);
          setIsRenaming(true);
        },
      },
      {
        label: "Reveal in Explorer",
        icon: <ExternalLinkIcon size={14} />,
        onSelect: () => onReveal(folder.id),
      },
      "separator",
      {
        label: "Delete folder",
        icon: <TrashIcon size={14} />,
        danger: true,
        onSelect: () => onDelete(folder.id),
      },
    ]);

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
      {/* biome-ignore lint/a11y/useFocusableInteractive: the tree container is the single tab stop and takes the arrow keys, so rows are not focusable */}
      <div
        className={`folder-row${isSelected ? " folder-row--selected" : ""}${isDragOver ? " folder-row--drag-over" : ""}`}
        role="treeitem"
        aria-selected={isSelected}
        onContextMenu={(e) => {
          if (isRenaming) return; // keep the input's own copy/paste menu
          e.preventDefault();
          e.stopPropagation(); // the tree behind has its own menu
          openMenu(e.clientX, e.clientY);
        }}
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

        <div className="folder-row__actions">
          <button
            type="button"
            className="folder-row__action-btn"
            onClick={() => setShowAddChild((v) => !v)}
            aria-label={`Add subfolder to ${folder.name}`}
            title="Add subfolder"
          >
            <PlusIcon size={13} />
          </button>
          <button
            type="button"
            className="folder-row__action-btn"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              openMenu(r.left, r.bottom + 2);
            }}
            aria-label="Folder options"
            aria-haspopup="menu"
          >
            <EllipsisIcon size={13} />
          </button>
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
                renamingItemId={renamingItemId}
                onSelect={onSelect}
                onSelectItem={onSelectItem}
                onItemPointerDown={onItemPointerDown}
                onAddSubfolder={onAddSubfolder}
                onRename={onRename}
                onDelete={onDelete}
                onNew={onNew}
                onReveal={onReveal}
                onOpenMenu={onOpenMenu}
                onItemContextMenu={onItemContextMenu}
                onItemRenameEnd={onItemRenameEnd}
              />
            ))}
          {expanded &&
            myItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                isUnsaved={unsavedItemId === item.id}
                isRenaming={renamingItemId === item.id}
                onSelect={onSelectItem}
                onPointerDown={onItemPointerDown}
                onContextMenu={onItemContextMenu}
                onRenameEnd={onItemRenameEnd}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default FolderRow;
