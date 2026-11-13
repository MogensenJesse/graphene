// src/components/Sidebar.tsx
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useClipboard } from "../hooks/useClipboard";
import { TRASH_DROP_ID, useDragToFolder } from "../hooks/useDragToFolder";
import type { UpdateStatus } from "../hooks/useUpdater";
import { firstCodeBlock } from "../lib/codeBlocks";
import { filterItems } from "../lib/search";
import { compareNames, flattenFolders, isCodeItem } from "../lib/utils";
import type { Folder, Item } from "../types";
import type { MenuEntry } from "./ContextMenu";
import { useContextMenu } from "./ContextMenuProvider";
import FolderRow from "./FolderRow";
import {
  ClipboardCopyIcon,
  ClipboardIcon,
  CodeIcon,
  CopyIcon,
  EditIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  HexagonIcon,
  NoFolderIcon,
  NoteIcon,
  PlusIcon,
  SearchIcon,
  SortIcon,
  TextCursorInputIcon,
  TrashIcon,
} from "./Icon";
import ItemRow from "./ItemRow";

type SortBy = "name" | "edited";

const SORT_ORDER: SortBy[] = ["name", "edited"];
const SORT_LABEL: Record<SortBy, string> = {
  name: "Name",
  edited: "Recent",
};
const SORT_KEY = "graphene.sort";

// What the version button says while an update check is in flight or has just finished
const VERSION_LABEL: Partial<Record<UpdateStatus, string>> = {
  checking: "checking…",
  "up-to-date": "up to date",
  error: "check failed",
};

const COMPARE: Record<SortBy, (a: Item, b: Item) => number> = {
  name: (a, b) => compareNames(a.title, b.title),
  edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

function readSort(): SortBy {
  try {
    const stored = localStorage.getItem(SORT_KEY);
    return SORT_ORDER.find((s) => s === stored) ?? "name";
  } catch {
    return "name";
  }
}

interface SidebarProps {
  items: Item[];
  folders: Folder[];
  selectedId: string | null;
  selectedFolderId: string | null;
  unsavedItemId: string | null;
  typeFilter: "all" | "note" | "code";
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
  onNew: (kind: "note" | "code", folderId?: string | null) => void;
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
  onOpenSearch: () => void;
  onTypeFilterChange: (filter: "all" | "note" | "code") => void;
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
  onOpenSearch,
  onTypeFilterChange,
}: SidebarProps) {
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderConfirmDeleteId, setFolderConfirmDeleteId] = useState<
    string | null
  >(null);
  const [sortBy, setSortBy] = useState<SortBy>(readSort);
  const { open, openAt } = useContextMenu();
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const { copy } = useClipboard();

  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  // Del key — start or confirm folder deletion (confirm requires same folder still selected)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Delete") {
        if (
          folderConfirmDeleteId !== null &&
          folderConfirmDeleteId === selectedFolderId
        ) {
          onDeleteFolder(folderConfirmDeleteId);
          setFolderConfirmDeleteId(null);
        } else if (selectedFolderId !== null) {
          setFolderConfirmDeleteId(selectedFolderId);
        }
      }
      if (e.key === "Escape" && folderConfirmDeleteId !== null) {
        setFolderConfirmDeleteId(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedFolderId, folderConfirmDeleteId, onDeleteFolder]);

  const { dragState, dragOverId, startDrag } = useDragToFolder((id, target) =>
    target === TRASH_DROP_ID ? onDeleteItem(id) : onMoveItem(id, target),
  );

  useEffect(() => {
    if (showAddFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [showAddFolder]);

  const rootFolders = useMemo(
    () =>
      folders
        .filter((f) => f.parentId === null)
        .sort((a, b) => compareNames(a.name, b.name)),
    [folders],
  );

  // No folder filter — the tree handles folder grouping visually.
  // filterItems returns a fresh array, so sorting it in place is safe.
  const filtered = useMemo(
    () => filterItems(items, "", typeFilter).sort(COMPARE[sortBy]),
    [items, typeFilter, sortBy],
  );

  const unfiledItems = useMemo(
    () => filtered.filter((i) => i.folderId === null),
    [filtered],
  );

  // While filtering by type, folders without a match disappear and the rest open up
  const isFiltering = typeFilter !== "all";

  const cycleSort = () => {
    const next =
      SORT_ORDER[(SORT_ORDER.indexOf(sortBy) + 1) % SORT_ORDER.length];
    setSortBy(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Preference only; the list still sorts for this session
    }
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

  const handleAddRootFolder = () => {
    const trimmed = newFolderName.trim();
    if (trimmed) onAddFolder(trimmed, null);
    setNewFolderName("");
    setShowAddFolder(false);
  };

  const handleAddFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddRootFolder();
    if (e.key === "Escape") {
      setNewFolderName("");
      setShowAddFolder(false);
    }
  };

  const handleAddSubfolder = (parentId: string, name: string) => {
    if (name.trim()) onAddFolder(name.trim(), parentId);
  };

  // The folder menu goes through the same confirmation banner as the Del key
  const requestDeleteFolder = (id: string) => {
    onSelectFolder(id); // the banner only renders for the selected folder
    setFolderConfirmDeleteId(id);
  };

  const treeEntries = (): MenuEntry[] => [
    {
      label: "New note",
      icon: <PlusIcon size={14} />,
      onSelect: () => onNew("note", null),
    },
    {
      label: "New code",
      icon: <CodeIcon size={14} />,
      onSelect: () => onNew("code", null),
    },
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
      ...flattenFolders(folders).map(({ folder, depth }) =>
        to(folder.id, folder.name, <FolderIcon size={14} />, depth),
      ),
    ];
  };

  const itemEntries = (item: Item): MenuEntry[] => {
    const code = isCodeItem(item);
    return [
      {
        label: "Open",
        icon: code ? <CodeIcon size={14} /> : <NoteIcon size={14} />,
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
      ...(code
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
      {/* Header — drag region */}
      <div className="sidebar__header" data-tauri-drag-region>
        <div className="sidebar__brand" data-tauri-drag-region>
          <HexagonIcon size={14} />
          <span>Graphene</span>
        </div>
        <div className="sidebar__version-wrap">
          {updateAvailable && (
            <button
              type="button"
              className="sidebar__update-pill"
              onClick={onShowUpdate}
              title="A new version is available"
            >
              Update
            </button>
          )}
          {version && (
            <button
              type="button"
              className="sidebar__version"
              onClick={onCheckUpdates}
              disabled={
                updateStatus === "checking" || updateStatus === "installing"
              }
              title="Check for updates"
            >
              {VERSION_LABEL[updateStatus] ?? `v${version}`}
            </button>
          )}
        </div>
      </div>

      {/* Type filter */}
      <div className="sidebar__segments">
        {(["all", "note", "code"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`sidebar__segment${typeFilter === f ? " sidebar__segment--active" : ""}`}
            aria-pressed={typeFilter === f}
            onClick={() => onTypeFilterChange(f)}
          >
            {f === "all" ? "All" : f === "note" ? "Notes" : "Code"}
          </button>
        ))}
      </div>

      {/* New note, new code, search */}
      <nav className="sidebar__nav">
        <button
          type="button"
          className="sidebar__nav-item"
          onClick={() => onNew("note")}
          title="New note (Ctrl+N)"
        >
          <PlusIcon size={16} />
          <span>New note</span>
        </button>
        <button
          type="button"
          className="sidebar__nav-item"
          onClick={() => onNew("code")}
          title="New code (Ctrl+Shift+N)"
        >
          <CodeIcon size={16} />
          <span>New code</span>
        </button>
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
              onClick={cycleSort}
              title={`Sorted by ${SORT_LABEL[sortBy].toLowerCase()} (click to change)`}
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
            <input
              ref={newFolderInputRef}
              className="sidebar__folder-add-input"
              type="text"
              placeholder="Folder name…"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={handleAddRootFolder}
              onKeyDown={handleAddFolderKeyDown}
            />
          </div>
        )}

        {/* Folder delete confirmation banner — only when the targeted folder is still selected */}
        {folderConfirmDeleteId !== null &&
          folderConfirmDeleteId === selectedFolderId && (
            <div className="sidebar__folder-confirm-delete">
              <span>
                Delete &ldquo;
                {folders.find((f) => f.id === folderConfirmDeleteId)?.name}
                &rdquo; and its subfolders? Items inside move up one level.
              </span>
              <div className="sidebar__folder-confirm-actions">
                <button
                  type="button"
                  className="sidebar__folder-confirm-btn sidebar__folder-confirm-btn--danger"
                  onClick={() => {
                    onDeleteFolder(folderConfirmDeleteId);
                    setFolderConfirmDeleteId(null);
                  }}
                >
                  delete
                </button>
                <button
                  type="button"
                  className="sidebar__folder-confirm-btn"
                  onClick={() => setFolderConfirmDeleteId(null)}
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
            onItemPointerDown={startDrag}
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
            onPointerDown={startDrag}
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
