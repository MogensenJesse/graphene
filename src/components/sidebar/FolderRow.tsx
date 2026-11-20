// src/components/sidebar/FolderRow.tsx
import { useContext, useMemo, useState } from "react";
import { VaultPathContext } from "../../lib/attachmentStore";
import { isFolderCollapsed, setFolderCollapsed } from "../../lib/prefs";
import type { Folder, Item, ItemKind } from "../../types";
import type { MenuEntry } from "../ui/ContextMenu";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FolderPlusIcon,
  PlusIcon,
  TextCursorInputIcon,
  TrashIcon,
} from "../ui/Icon";
import InlineInput from "../ui/InlineInput";
import { newItemEntries } from "../ui/newKinds";
import Tooltip from "../ui/Tooltip";
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
  // Orders the sub-folders of every folder (by rank, or by name)
  compareFolders: (a: Folder, b: Folder) => number;
  onSelect: (id: string | null) => void;
  onSelectItem: (id: string) => void;
  onItemPointerDown: (
    e: React.PointerEvent,
    itemId: string,
    label: string,
  ) => void;
  onFolderPointerDown: (e: React.PointerEvent, folder: Folder) => void;
  onAddSubfolder: (parentId: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  // The folder whose delete is waiting for a yes; its row shows the question right below itself
  deleteConfirmId: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onNew: (kind: ItemKind, folderId: string) => void;
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
  compareFolders,
  onSelect,
  onSelectItem,
  onItemPointerDown,
  onFolderPointerDown,
  onAddSubfolder,
  onRename,
  onDelete,
  deleteConfirmId,
  onConfirmDelete,
  onCancelDelete,
  onNew,
  onReveal,
  onOpenMenu,
  onItemContextMenu,
  onItemRenameEnd,
}: FolderRowProps) {
  // ponytail: collapsed state is keyed by vault and folder path, so a renamed folder comes back expanded
  const vault = useContext(VaultPathContext) ?? "";
  const [isExpanded, setIsExpanded] = useState(
    () => !isFolderCollapsed(vault, folder.id),
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);

  const children = useMemo(
    () =>
      allFolders.filter((f) => f.parentId === folder.id).sort(compareFolders),
    [allFolders, folder.id, compareFolders],
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

  if (forceExpand && !hasMatch) return null;

  const setExpanded = (value: boolean) => {
    setIsExpanded(value);
    setFolderCollapsed(vault, folder.id, !value);
  };

  const openMenu = (x: number, y: number) =>
    onOpenMenu(x, y, [
      ...newItemEntries((kind) => onNew(kind, folder.id), " here"),
      {
        label: "New subfolder",
        icon: <FolderPlusIcon size={14} />,
        onSelect: () => setShowAddChild(true),
      },
      "separator",
      {
        label: "Rename",
        icon: <TextCursorInputIcon size={14} />,
        onSelect: () => setIsRenaming(true),
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

  const handleRenameCommit = (name: string) => {
    if (name !== folder.name) onRename(folder.id, name);
    setIsRenaming(false);
  };

  const handleAddChildCommit = (name: string) => {
    onAddSubfolder(folder.id, name);
    setShowAddChild(false);
    setExpanded(true);
  };

  return (
    // data-folder-drop-id marks this group as a drop target for the pointer-event DnD system; data-sort-* lets a
    // dragged sibling folder land before or after it (the line is drawn on the whole group, see useDragToFolder)
    <div
      className="folder-row__group"
      data-folder-drop-id={folder.id}
      data-sort-kind="folder"
      data-sort-id={folder.id}
      data-sort-parent={folder.parentId ?? ""}
    >
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
          <InlineInput
            initial={folder.name}
            className="folder-row__rename-input"
            onCommit={handleRenameCommit}
            onCancel={() => setIsRenaming(false)}
          />
        ) : (
          <button
            type="button"
            className="folder-row__name"
            aria-expanded={hasContents ? expanded : undefined}
            onPointerDown={(e) => onFolderPointerDown(e, folder)}
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
          <Tooltip label="Add subfolder">
            <button
              type="button"
              className="folder-row__action-btn"
              onClick={() => setShowAddChild((v) => !v)}
              aria-label={`Add subfolder to ${folder.name}`}
            >
              <PlusIcon size={13} />
            </button>
          </Tooltip>
          <Tooltip label="Folder options">
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
          </Tooltip>
        </div>
      </div>

      {deleteConfirmId === folder.id && (
        <div className="sidebar__folder-confirm-delete">
          <span>
            Delete &ldquo;{folder.name}&rdquo; and its subfolders? Items inside
            move up one level.
          </span>
          <div className="sidebar__folder-confirm-actions">
            <button
              type="button"
              className="sidebar__folder-confirm-btn sidebar__folder-confirm-btn--danger"
              onClick={onConfirmDelete}
            >
              Delete
            </button>
            <button
              type="button"
              className="sidebar__folder-confirm-btn"
              onClick={onCancelDelete}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {((expanded && hasContents) || showAddChild) && (
        <div className="folder-row__children">
          {showAddChild && (
            <div className="folder-row__add-child">
              <InlineInput
                className="folder-row__rename-input"
                placeholder="Subfolder name…"
                onCommit={handleAddChildCommit}
                onCancel={() => setShowAddChild(false)}
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
                compareFolders={compareFolders}
                onSelect={onSelect}
                onSelectItem={onSelectItem}
                onItemPointerDown={onItemPointerDown}
                onFolderPointerDown={onFolderPointerDown}
                onAddSubfolder={onAddSubfolder}
                onRename={onRename}
                onDelete={onDelete}
                deleteConfirmId={deleteConfirmId}
                onConfirmDelete={onConfirmDelete}
                onCancelDelete={onCancelDelete}
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
