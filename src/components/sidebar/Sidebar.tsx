// src/components/sidebar/Sidebar.tsx
import { type ReactNode, useMemo, useRef, useState } from "react";
import { useClipboard } from "../../hooks/useClipboard";
import { useDeleteConfirm } from "../../hooks/useDeleteConfirm";
import {
  type NearRow,
  TRASH_DROP_ID,
  useDragToFolder,
} from "../../hooks/useDragToFolder";
import type { UpdateStatus } from "../../hooks/useUpdater";
import { firstCodeBlock } from "../../lib/codeBlocks";
import {
  compareFoldersManual,
  compareItemsManual,
  placeNear,
} from "../../lib/order";
import { readPref, writePref } from "../../lib/prefs";
import { filterByType } from "../../lib/search";
import { compareNames, flattenFolders, itemKind } from "../../lib/utils";
import type { Folder, Item, ItemKind, TypeFilter } from "../../types";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import {
  ClipboardCopyIcon,
  ClipboardIcon,
  CopyIcon,
  EditIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  KindIcon,
  NoFolderIcon,
  PlusIcon,
  SearchIcon,
  SortIcon,
  TextCursorInputIcon,
  TrashIcon,
} from "../ui/Icon";
import InlineInput from "../ui/InlineInput";
import { NEW_KINDS, newItemEntries } from "../ui/newKinds";
import FolderRow from "./FolderRow";
import ItemRow from "./ItemRow";
import SidebarHeader from "./SidebarHeader";
import ThemeButton from "./ThemeButton";

// How the sidebar lists notes and sibling folders. "manual" follows the ranks set by dragging
// (a folder or note without one comes last, by name); folders have no date, so they go by name otherwise.
type SortBy = "manual" | "name" | "edited";

const SORT_ORDER: SortBy[] = ["manual", "name", "edited"];
const SORT_LABEL: Record<SortBy, string> = {
  manual: "Manual",
  name: "Name",
  edited: "Recent",
};
const SORT_KEY = "graphene.sort";

const FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "note", label: "Notes" },
  { value: "todo", label: "To-dos" },
  { value: "code", label: "Code" },
];

const COMPARE: Record<SortBy, (a: Item, b: Item) => number> = {
  manual: compareItemsManual,
  name: (a, b) => compareNames(a.title, b.title),
  edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

const byFolderName = (a: Folder, b: Folder) => compareNames(a.name, b.name);
const FOLDER_COMPARE: Record<SortBy, (a: Folder, b: Folder) => number> = {
  manual: compareFoldersManual,
  name: byFolderName,
  edited: byFolderName,
};

function readSort(): SortBy {
  const stored = readPref(SORT_KEY);
  return SORT_ORDER.find((s) => s === stored) ?? "manual";
}

interface SidebarProps {
  items: Item[];
  folders: Folder[];
  selectedId: string | null;
  selectedFolderId: string | null;
  unsavedItemId: string | null;
  typeFilter: TypeFilter;
  trashedCount: number;
  trashOpen: boolean;
  version: string;
  updateStatus: UpdateStatus;
  updateAvailable: boolean;
  // Item open in the editor: its title and folder belong to the editor until it closes
  editingItemId: string | null;
  onSelect: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  // folderId omitted = wherever the selection is; null = no folder
  onNew: (kind: ItemKind, folderId?: string | null) => void;
  onEditItem: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, title: string) => void;
  onRevealItem: (item: Item) => void;
  onRevealFolder: (folderId: string) => void;
  onCheckUpdates: () => void;
  onShowUpdate: () => void;
  onOpenTrash: () => void;
  onAddFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveItem: (itemId: string, targetFolderId: string | null) => void;
  // Puts notes in a new order: the ranks to write, and the note that was dragged with the folder it now sits in
  onReorderItems: (
    ranks: Record<string, number>,
    movedId: string,
    folderId: string | null,
  ) => void;
  onReorderFolders: (ranks: Record<string, number>) => void;
  onOpenSearch: () => void;
  onTypeFilterChange: (filter: TypeFilter) => void;
}

function Sidebar({
  items,
  folders,
  selectedId,
  selectedFolderId,
  unsavedItemId,
  typeFilter,
  trashedCount,
  trashOpen,
  version,
  updateStatus,
  updateAvailable,
  editingItemId,
  onSelect,
  onSelectFolder,
  onNew,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  onRenameItem,
  onRevealItem,
  onRevealFolder,
  onCheckUpdates,
  onShowUpdate,
  onOpenTrash,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveItem,
  onReorderItems,
  onReorderFolders,
  onOpenSearch,
  onTypeFilterChange,
}: SidebarProps) {
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>(readSort);
  const { open, openAt } = useContextMenu();
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const { copy } = useClipboard();

  const treeRef = useRef<HTMLDivElement>(null);

  // The Del key and the folder menu ask first; the banner below is the confirmation
  const folderDelete = useDeleteConfirm(
    selectedFolderId ?? "",
    () => {
      if (selectedFolderId !== null) onDeleteFolder(selectedFolderId);
    },
    selectedFolderId !== null,
  );

  const { dragState, dragOverId, startDrag } = useDragToFolder(
    (source, target, near) => {
      if (near) {
        if (source.kind === "item") placeItem(source.id, near);
        else placeFolder(source.id, near);
      } else if (target === TRASH_DROP_ID) onDeleteItem(source.id);
      else if (target !== undefined) onMoveItem(source.id, target);
    },
  );
  const startItemDrag = (e: React.PointerEvent, id: string, label: string) =>
    startDrag(e, { kind: "item", id, label });
  const startFolderDrag = (e: React.PointerEvent, folder: Folder) =>
    startDrag(e, {
      kind: "folder",
      id: folder.id,
      label: folder.name,
      parent: folder.parentId ?? "",
    });

  const rootFolders = useMemo(
    () =>
      folders.filter((f) => f.parentId === null).sort(FOLDER_COMPARE[sortBy]),
    [folders, sortBy],
  );

  // No folder filter — the tree handles folder grouping visually.
  // filterByType returns a fresh array, so sorting it in place is safe.
  const filtered = useMemo(
    () => filterByType(items, typeFilter).sort(COMPARE[sortBy]),
    [items, typeFilter, sortBy],
  );

  const unfiledItems = useMemo(
    () => filtered.filter((i) => i.folderId === null),
    [filtered],
  );

  // While filtering by type, folders without a match disappear and the rest open up
  const isFiltering = typeFilter !== "all";

  const chooseSort = (next: SortBy) => {
    setSortBy(next);
    writePref(SORT_KEY, next);
  };

  const openSortMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    openAt(
      r.left,
      r.bottom + 2,
      SORT_ORDER.map((s) => ({
        label: SORT_LABEL[s],
        checked: s === sortBy,
        onSelect: () => chooseSort(s),
      })),
    );
  };

  // A note or folder dropped next to another: ranks for it and for the siblings that need one (see lib/order).
  // From Name or Recent they number the list as it is shown, so nothing jumps, and the order becomes Manual.
  const placeItem = (movedId: string, near: NearRow) => {
    const anchor = items.find((i) => i.id === near.id);
    if (!anchor) return;
    const siblings = items
      .filter((i) => i.folderId === anchor.folderId)
      .sort(COMPARE[sortBy]);
    const ranks = placeNear(
      siblings,
      movedId,
      near.id,
      near.after,
      sortBy !== "manual",
    );
    if (Object.keys(ranks).length === 0) return;
    onReorderItems(ranks, movedId, anchor.folderId);
    chooseSort("manual");
  };

  const placeFolder = (movedId: string, near: NearRow) => {
    const anchor = folders.find((f) => f.id === near.id);
    if (!anchor) return;
    const siblings = folders
      .filter((f) => f.parentId === anchor.parentId)
      .sort(FOLDER_COMPARE[sortBy]);
    const ranks = placeNear(
      siblings,
      movedId,
      near.id,
      near.after,
      sortBy !== "manual",
    );
    if (Object.keys(ranks).length === 0) return;
    onReorderFolders(ranks);
    chooseSort("manual");
  };

  // DOM order is visual order, so collapsed folders and filters are respected for free
  const moveSelection = (delta: 1 | -1) => {
    const rows = Array.from(
      treeRef.current?.querySelectorAll<HTMLElement>("[data-item-id]") ?? [],
    );
    if (rows.length === 0) return;
    const current = rows.findIndex((r) => r.dataset.itemId === selectedId);
    const next = rows[Math.min(rows.length - 1, Math.max(0, current + delta))];
    const id = next.dataset.itemId;
    if (!id) return;
    onSelect(id);
    next.scrollIntoView({ block: "nearest" });
  };

  const handleTreeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ignore keys typed into the folder name inputs that live inside the tree
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (
      e.key === "F2" ||
      e.key === "ContextMenu" ||
      (e.key === "F10" && e.shiftKey)
    ) {
      const row = selectedId
        ? treeRef.current?.querySelector<HTMLElement>(
            `[data-item-id="${selectedId}"]`,
          )
        : null;
      const item = items.find((i) => i.id === selectedId);
      e.preventDefault();
      if (e.key === "F2") {
        if (row && item) setRenamingItemId(item.id);
        return;
      }
      // Anchored on the selected row, or on the tree when nothing visible is selected
      const rect = (row ?? treeRef.current)?.getBoundingClientRect();
      if (rect)
        openAt(
          rect.left + 24,
          rect.bottom,
          row && item ? itemEntries(item) : treeEntries(),
        );
    }
  };

  // Clicking an item parks focus on the tree so the arrow keys keep working from there
  const selectItem = (id: string) => {
    onSelect(id);
    treeRef.current?.focus({ preventScroll: true });
  };

  const handleAddSubfolder = (parentId: string, name: string) =>
    onAddFolder(name, parentId);

  // The folder menu goes through the same confirmation banner as the Del key
  const requestDeleteFolder = (id: string) => {
    onSelectFolder(id); // the banner only renders for the selected folder
    folderDelete.arm(id);
  };

  const treeEntries = (): MenuEntry[] => [
    ...newItemEntries((kind) => onNew(kind, null)),
    "separator",
    {
      label: "New folder",
      icon: <FolderPlusIcon size={14} />,
      onSelect: () => setShowAddFolder(true),
    },
  ];

  const moveEntries = (item: Item): MenuEntry[] => {
    const to = (
      folderId: string | null,
      label: string,
      icon: ReactNode,
      indent = 0,
    ): MenuEntry => ({
      label,
      icon,
      indent,
      checked: item.folderId === folderId,
      disabled: item.folderId === folderId || item.id === editingItemId,
      onSelect: () => onMoveItem(item.id, folderId),
    });
    return [
      to(null, "Unfiled", <NoFolderIcon size={14} />),
      ...flattenFolders(folders, FOLDER_COMPARE[sortBy]).map(
        ({ folder, depth }) =>
          to(folder.id, folder.name, <FolderIcon size={14} />, depth),
      ),
    ];
  };

  const itemEntries = (item: Item): MenuEntry[] => {
    const kind = itemKind(item);
    return [
      {
        label: "Open",
        icon: <KindIcon kind={kind} size={14} />,
        onSelect: () => selectItem(item.id),
      },
      {
        label: "Edit",
        icon: <EditIcon size={14} />,
        onSelect: () => onEditItem(item.id),
      },
      {
        label: "Rename",
        icon: <TextCursorInputIcon size={14} />,
        disabled: item.id === editingItemId,
        onSelect: () => setRenamingItemId(item.id),
      },
      {
        label: "Duplicate",
        icon: <CopyIcon size={14} />,
        onSelect: () => onDuplicateItem(item.id),
      },
      {
        label: "Copy note",
        icon: <ClipboardIcon size={14} />,
        onSelect: () => copy(item.body),
      },
      ...(kind === "code"
        ? [
            {
              label: "Copy code",
              icon: <ClipboardCopyIcon size={14} />,
              onSelect: () => copy(firstCodeBlock(item.body)),
            },
          ]
        : []),
      "separator",
      {
        label: "Move to",
        icon: <FolderInputIcon size={14} />,
        submenu: moveEntries(item),
      },
      {
        label: "Reveal in Explorer",
        icon: <ExternalLinkIcon size={14} />,
        onSelect: () => onRevealItem(item),
      },
      "separator",
      {
        label: "Move to trash",
        icon: <TrashIcon size={14} />,
        danger: true,
        onSelect: () => onDeleteItem(item.id),
      },
    ];
  };

  const handleItemContextMenu = (e: React.MouseEvent, item: Item) =>
    open(e, itemEntries(item)); // stops the event: the tree behind has its own menu

  const handleItemRenameEnd = (id: string, title: string | null) => {
    setRenamingItemId(null);
    const current = items.find((i) => i.id === id);
    if (title !== null && current && title !== current.title)
      onRenameItem(id, title);
    // Enter/Escape leave focus on the removed input; a blur (click elsewhere) must keep its new target
    if (document.activeElement instanceof HTMLInputElement)
      treeRef.current?.focus({ preventScroll: true });
  };

  // The tree itself is the "unfiled" drop target: folder groups win, empty space and root items unfile
  const isRootDragOver = dragState !== null && dragOverId === null;

  return (
    <aside className="sidebar">
      <SidebarHeader
        version={version}
        updateStatus={updateStatus}
        updateAvailable={updateAvailable}
        onCheckUpdates={onCheckUpdates}
        onShowUpdate={onShowUpdate}
      />

      {/* Type filter */}
      <div className="sidebar__segments">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`sidebar__segment${typeFilter === value ? " sidebar__segment--active" : ""}`}
            aria-pressed={typeFilter === value}
            onClick={() => onTypeFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* New note, new code, search */}
      <nav className="sidebar__nav">
        {NEW_KINDS.map(({ kind, label, Icon, shortcut }) => (
          <button
            key={kind}
            type="button"
            className="sidebar__nav-item"
            onClick={() => onNew(kind)}
            title={`New ${label} (${shortcut})`}
          >
            <Icon size={16} />
            <span>New {label}</span>
          </button>
        ))}
        <button
          type="button"
          className="sidebar__nav-item"
          onClick={onOpenSearch}
          title="Search (Ctrl+K)"
        >
          <SearchIcon size={16} />
          <span>Search</span>
          <span className="sidebar__nav-count">Ctrl K</span>
        </button>
      </nav>

      {/* Folder + tree section */}
      <div
        ref={treeRef}
        className={`sidebar__folders${isRootDragOver ? " sidebar__folders--drag-over" : ""}`}
        data-folder-drop-id="unfiled"
        role="tree"
        // a tree is a composite widget: the container is the single tab stop and takes the arrow keys
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
        onContextMenu={(e) => open(e, treeEntries())}
        onClick={(e) => {
          // Empty space deselects the folder
          if (e.target === e.currentTarget) onSelectFolder(null);
        }}
      >
        <div className="sidebar__folders-header">
          <span className="sidebar__folders-label">Folders</span>
          <div className="sidebar__folders-tools">
            <button
              type="button"
              className="sidebar__sort-btn"
              onClick={openSortMenu}
              aria-haspopup="menu"
              title={`Order: ${SORT_LABEL[sortBy]} (click to change)`}
            >
              <SortIcon size={11} />
              {SORT_LABEL[sortBy]}
            </button>
            <button
              type="button"
              className="sidebar__icon-btn"
              onClick={() => setShowAddFolder((v) => !v)}
              aria-label="Add folder"
              title="Add folder"
            >
              <PlusIcon size={13} />
            </button>
          </div>
        </div>

        {showAddFolder && (
          <div className="sidebar__folder-add-row">
            <InlineInput
              className="sidebar__folder-add-input"
              placeholder="Folder name…"
              onCommit={(name) => {
                onAddFolder(name, null);
                setShowAddFolder(false);
              }}
              onCancel={() => setShowAddFolder(false)}
            />
          </div>
        )}

        {/* Folder delete confirmation banner — only when the targeted folder is still selected */}
        {folderDelete.confirming && selectedFolderId !== null && (
          <div className="sidebar__folder-confirm-delete">
            <span>
              Delete &ldquo;
              {folders.find((f) => f.id === selectedFolderId)?.name}
              &rdquo; and its subfolders? Items inside move up one level.
            </span>
            <div className="sidebar__folder-confirm-actions">
              <button
                type="button"
                className="sidebar__folder-confirm-btn sidebar__folder-confirm-btn--danger"
                onClick={folderDelete.requestDelete}
              >
                delete
              </button>
              <button
                type="button"
                className="sidebar__folder-confirm-btn"
                onClick={folderDelete.cancelConfirm}
              >
                cancel
              </button>
            </div>
          </div>
        )}

        {rootFolders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            allFolders={folders}
            items={filtered}
            selectedFolderId={selectedFolderId}
            selectedId={selectedId}
            unsavedItemId={unsavedItemId}
            dragOverId={dragOverId}
            forceExpand={isFiltering}
            renamingItemId={renamingItemId}
            onSelect={onSelectFolder}
            onSelectItem={selectItem}
            compareFolders={FOLDER_COMPARE[sortBy]}
            onItemPointerDown={startItemDrag}
            onFolderPointerDown={startFolderDrag}
            onAddSubfolder={handleAddSubfolder}
            onRename={onRenameFolder}
            onDelete={requestDeleteFolder}
            onNew={onNew}
            onReveal={onRevealFolder}
            onOpenMenu={openAt}
            onItemContextMenu={handleItemContextMenu}
            onItemRenameEnd={handleItemRenameEnd}
          />
        ))}

        {/* Unfiled items — no folder assigned */}
        {unfiledItems.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            isUnsaved={unsavedItemId === item.id}
            isRenaming={renamingItemId === item.id}
            onSelect={selectItem}
            onPointerDown={startItemDrag}
            onContextMenu={handleItemContextMenu}
            onRenameEnd={handleItemRenameEnd}
          />
        ))}

        {filtered.length === 0 && (
          <div className="sidebar__empty">
            {items.length === 0 ? "Nothing here yet" : "No results"}
          </div>
        )}
      </div>

      {/* Trash */}
      <div className="sidebar__footer">
        <button
          type="button"
          className={`sidebar__nav-item${trashOpen ? " sidebar__nav-item--active" : ""}${dragState && dragOverId === TRASH_DROP_ID ? " sidebar__nav-item--drag-over" : ""}`}
          onClick={onOpenTrash}
          onContextMenu={(e) =>
            open(e, [
              {
                label: "Open trash",
                icon: <TrashIcon size={14} />,
                onSelect: onOpenTrash,
              },
            ])
          }
          data-folder-drop-id={TRASH_DROP_ID}
          title="Trash"
        >
          <TrashIcon size={16} />
          <span>Trash</span>
          {trashedCount > 0 && (
            <span className="sidebar__nav-count">{trashedCount}</span>
          )}
        </button>
        <ThemeButton />
      </div>

      {/* Drag ghost — follows cursor while dragging */}
      {dragState && (
        <div
          className="drag-ghost"
          style={{ left: dragState.x, top: dragState.y }}
          aria-hidden="true"
        >
          {dragState.label}
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
