// src/components/sidebar/FolderRow.tsx
import {
  memo,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useDragValue } from "../../hooks/useDragToFolder";
import { VaultPathContext } from "../../lib/attachmentStore";
import type { DragStore } from "../../lib/dragStore";
import { namesUnder, validateFolderName } from "../../lib/folderName";
import { isInside } from "../../lib/folderOps";
import { perfRender } from "../../lib/perf";
import {
  isFolderCollapsed,
  setFolderCollapsed,
  subscribeCollapsed,
} from "../../lib/prefs";
import { type NotesByFolder, notesUnder } from "../../lib/rowItems";
import { folderLevel, treeItemId } from "../../lib/treeNav";
import { flattenFolders, itemKind } from "../../lib/utils";
import type { Folder, Item, ItemKind } from "../../types";
import ConfirmBar from "../ui/ConfirmBar";
import type { MenuEntry } from "../ui/ContextMenu";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  NoFolderIcon,
  PlusIcon,
  TextCursorInputIcon,
  TrashIcon,
} from "../ui/Icon";
import IconButton from "../ui/IconButton";
import InlineInput from "../ui/InlineInput";
import { newItemEntries } from "../ui/newKinds";
import Tooltip from "../ui/Tooltip";
import ItemRow from "./ItemRow";

// A row is memoised: what it is given is plain values, arrays that keep their identity while their notes do (see lib/rowItems) and
// functions that keep theirs, so a batch of note texts, or a frame of a drag, renders none of them
interface FolderRowProps {
  folder: Folder;
  allFolders: Folder[];
  // The notes of every folder; a row reads its own (and its subfolders' rows theirs)
  byFolder: NotesByFolder;
  selectedFolderId: string | null;
  selectedId: string | null;
  unsavedItemId: string | null;
  // The drag in progress: whether it is over this folder is read from here, so a frame of the drag renders nothing
  drag: DragStore;
  renamingItemId: string | null;
  // The folder whose name is being edited (the Sidebar owns it, so F2 can start it) and how it changes
  renamingFolderId: string | null;
  onRenamingFolder: (id: string | null) => void;
  // Orders the sub-folders of every folder (by rank, or by name)
  compareFolders: (a: Folder, b: Folder) => number;
  // One place up or down among the folders of the same parent
  onMove: (id: string, delta: 1 | -1) => void;
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
  onCopyPath: (folderId: string) => void;
  // Puts the folder under another parent (null: the top level)
  onMoveTo: (id: string, parentId: string | null) => void;
  onOpenMenu: (x: number, y: number, entries: MenuEntry[]) => void;
  onItemContextMenu: (e: React.MouseEvent, id: string) => void;
  onItemRenameEnd: (id: string, title: string | null) => void;
  // The "…" button of a note: its menu at x, y
  onItemMore: (id: string, x: number, y: number) => void;
}

const NO_NOTES: Item[] = [];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What the delete banner says. It must match what deleteFolder (hooks/useFolders) does: every note under
// the folder, at any depth, moves up to the folder's parent; the subfolders are removed, not moved. The Undo bar that follows
// (App, handleDeleteFolder) brings all of it back.
function deleteQuestion(
  folder: Folder,
  allFolders: Folder[],
  byFolder: NotesByFolder,
) {
  const inside = `${folder.id}/`;
  const subfolders = allFolders.filter((f) => f.id.startsWith(inside)).length;
  const notes = notesUnder(folder, byFolder);
  const parent = allFolders.find((f) => f.id === folder.parentId)?.name;
  return [
    `Delete “${folder.name}”?`,
    notes > 0 &&
      `${plural(notes, "note")} inside ${notes === 1 ? "moves" : "move"} up to ${parent ? `“${parent}”` : "the top level"}.`,
    subfolders > 0 &&
      `${plural(subfolders, "subfolder")} ${subfolders === 1 ? "is" : "are"} removed, not moved.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function FolderRow({
  folder,
  allFolders,
  byFolder,
  selectedFolderId,
  selectedId,
  unsavedItemId,
  drag,
  renamingItemId,
  renamingFolderId,
  onRenamingFolder,
  compareFolders,
  onMove,
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
  onCopyPath,
  onMoveTo,
  onOpenMenu,
  onItemContextMenu,
  onItemRenameEnd,
  onItemMore,
}: FolderRowProps) {
  perfRender("FolderRow");
  // ponytail: collapsed state is keyed by vault and folder path, so a renamed folder comes back expanded
  const vault = useContext(VaultPathContext) ?? "";
  // Read on every render (a set lookup): the Sidebar opens the folders around a note that was picked from elsewhere, in the same render
  // that picks it. The subscription is for the rest, a click here or a key on the tree: it renders this row and no other
  const isExpanded = !useSyncExternalStore(subscribeCollapsed, () =>
    isFolderCollapsed(vault, folder.id),
  );
  const level = folderLevel(folder.id);
  const isRenaming = renamingFolderId === folder.id;
  const setIsRenaming = (on: boolean) =>
    onRenamingFolder(on ? folder.id : null);
  const [showAddChild, setShowAddChild] = useState(false);

  const children = useMemo(
    () =>
      allFolders.filter((f) => f.parentId === folder.id).sort(compareFolders),
    [allFolders, folder.id, compareFolders],
  );
  const myItems = byFolder.get(folder.id) ?? NO_NOTES;
  const hasContents = children.length > 0 || myItems.length > 0;
  const isSelected = selectedFolderId === folder.id;
  const isDragOver = useDragValue(drag, (view) => view.overId === folder.id);
  const expanded = isExpanded;

  const setExpanded = (value: boolean) => {
    setFolderCollapsed(vault, folder.id, !value);
  };

  // Where this folder could go: the top level or any folder that is not itself or inside itself (a name that is taken there is
  // refused with a message when chosen)
  const moveToEntries = (): MenuEntry[] => {
    const to = (
      parentId: string | null,
      label: string,
      icon: React.ReactNode,
      indent = 0,
    ): MenuEntry => ({
      label,
      icon,
      indent,
      checked: folder.parentId === parentId,
      disabled: folder.parentId === parentId,
      onSelect: () => onMoveTo(folder.id, parentId),
    });
    return [
      to(null, "Top level", <NoFolderIcon size={14} />),
      ...flattenFolders(allFolders, compareFolders)
        .filter((row) => !isInside(row.folder.id, folder.id))
        .map((row) =>
          to(
            row.folder.id,
            row.folder.name,
            <FolderIcon size={14} />,
            row.depth,
          ),
        ),
    ];
  };

  // What "+" opens, and the head of the folder's menu: a note or code here, or a subfolder
  const newEntries = (): MenuEntry[] => [
    ...newItemEntries((kind) => onNew(kind, folder.id), " here"),
    {
      label: "New subfolder",
      icon: <FolderPlusIcon size={14} />,
      onSelect: () => setShowAddChild(true),
    },
  ];

  const openMenu = (x: number, y: number) => {
    const siblings = allFolders
      .filter((f) => f.parentId === folder.parentId)
      .sort(compareFolders);
    const at = siblings.findIndex((f) => f.id === folder.id);
    onOpenMenu(x, y, [
      ...newEntries(),
      "separator",
      {
        label: "Rename",
        icon: <TextCursorInputIcon size={14} />,
        keys: "F2",
        onSelect: () => setIsRenaming(true),
      },
      {
        label: "Move up",
        icon: <ChevronUpIcon size={14} />,
        disabled: at <= 0,
        onSelect: () => onMove(folder.id, -1),
      },
      {
        label: "Move down",
        icon: <ChevronDownIcon size={14} />,
        disabled: at === -1 || at === siblings.length - 1,
        onSelect: () => onMove(folder.id, 1),
      },
      {
        label: "Move to",
        icon: <FolderInputIcon size={14} />,
        submenu: moveToEntries(),
      },
      {
        label: "Show in Explorer",
        icon: <ExternalLinkIcon size={14} />,
        onSelect: () => onReveal(folder.id),
      },
      {
        label: "Copy path",
        icon: <ClipboardIcon size={14} />,
        onSelect: () => onCopyPath(folder.id),
      },
      "separator",
      {
        label: "Delete folder",
        icon: <TrashIcon size={14} />,
        keys: "Del",
        danger: true,
        onSelect: () => onDelete(folder.id),
      },
    ]);
  };

  // A name the field refuses is said in the field (see InlineInput); unchanged is no rename
  const validateRename = (name: string) =>
    name === folder.name
      ? null
      : validateFolderName(
          name,
          namesUnder(allFolders, folder.parentId),
          folder.name,
          folder.parentId,
        );
  const validateChild = (name: string) =>
    validateFolderName(
      name,
      namesUnder(allFolders, folder.id),
      undefined,
      folder.id,
    );

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
        id={treeItemId({ kind: "folder", id: folder.id })}
        role="treeitem"
        aria-level={level}
        aria-expanded={hasContents ? expanded : undefined}
        aria-selected={isSelected}
        // Its name only: the buttons in the row are not part of it
        aria-label={folder.name}
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
            validate={validateRename}
            onCommit={handleRenameCommit}
            onCancel={() => setIsRenaming(false)}
          />
        ) : (
          <button
            type="button"
            className="folder-row__name"
            onPointerDown={(e) => onFolderPointerDown(e, folder)}
            onClick={() => {
              onSelect(folder.id);
              setExpanded(!isExpanded);
            }}
          >
            <span className="folder-row__label">{folder.name}</span>
            {hasContents && (
              <span
                className={`folder-row__chevron chevron-turn${expanded ? " chevron-turn--open" : ""}`}
                aria-hidden="true"
              >
                <ChevronRightIcon size={12} />
              </span>
            )}
          </button>
        )}

        <div className="folder-row__actions">
          <Tooltip label="New here">
            <IconButton
              size="sm"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onOpenMenu(r.left, r.bottom + 2, newEntries());
              }}
              aria-label={`New in ${folder.name}`}
              aria-haspopup="menu"
            >
              <PlusIcon size={13} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Folder options">
            <IconButton
              size="sm"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                openMenu(r.left, r.bottom + 2);
              }}
              aria-label="Folder options"
              aria-haspopup="menu"
            >
              <EllipsisIcon size={13} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {deleteConfirmId === folder.id && (
        <ConfirmBar
          question={deleteQuestion(folder, allFolders, byFolder)}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}

      {((expanded && hasContents) || showAddChild) && (
        // biome-ignore lint/a11y/useSemanticElements: the group of a tree item's children, not a set of form controls
        <div className="folder-row__children" role="group">
          {showAddChild && (
            <div className="folder-row__add-child">
              <InlineInput
                className="folder-row__rename-input"
                placeholder="Subfolder name…"
                validate={validateChild}
                onCommit={handleAddChildCommit}
                onCancel={() => setShowAddChild(false)}
              />
            </div>
          )}
          {expanded &&
            children.map((child) => (
              <MemoFolderRow
                key={child.id}
                folder={child}
                allFolders={allFolders}
                byFolder={byFolder}
                selectedFolderId={selectedFolderId}
                selectedId={selectedId}
                unsavedItemId={unsavedItemId}
                drag={drag}
                renamingItemId={renamingItemId}
                renamingFolderId={renamingFolderId}
                onRenamingFolder={onRenamingFolder}
                compareFolders={compareFolders}
                onMove={onMove}
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
                onCopyPath={onCopyPath}
                onMoveTo={onMoveTo}
                onOpenMenu={onOpenMenu}
                onItemContextMenu={onItemContextMenu}
                onItemRenameEnd={onItemRenameEnd}
                onItemMore={onItemMore}
              />
            ))}
          {expanded &&
            myItems.map((item) => (
              <ItemRow
                key={item.id}
                id={item.id}
                title={item.title}
                kind={itemKind(item)}
                isSelected={selectedId === item.id}
                isUnsaved={unsavedItemId === item.id}
                isRenaming={renamingItemId === item.id}
                level={level + 1}
                onSelect={onSelectItem}
                onPointerDown={onItemPointerDown}
                onContextMenu={onItemContextMenu}
                onRenameEnd={onItemRenameEnd}
                onMore={onItemMore}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// The subfolders are rendered through the memoised row too, or only the top level would be
const MemoFolderRow = memo(FolderRow);

export default MemoFolderRow;
