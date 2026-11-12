// src/components/Sidebar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useDragToFolder } from "../hooks/useDragToFolder";
import { filterItems } from "../lib/search";
import { compareNames } from "../lib/utils";
import type { Folder, Item } from "../types";
import FolderRow from "./FolderRow";
import ItemRow from "./ItemRow";

type SortBy = "name" | "edited" | "copied";

const SORT_ORDER: SortBy[] = ["name", "edited", "copied"];
const SORT_LABEL: Record<SortBy, string> = {
  name: "name",
  edited: "recent",
  copied: "copied",
};
const SORT_KEY = "graphene.sort";

const copiesOf = (item: Item) => (item.type === "snippet" ? item.copies : -1);

const COMPARE: Record<SortBy, (a: Item, b: Item) => number> = {
  name: (a, b) => compareNames(a.title, b.title),
  edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  copied: (a, b) => copiesOf(b) - copiesOf(a) || compareNames(a.title, b.title),
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
  typeFilter: "all" | "note" | "snippet";
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  onNew: () => void;
  onAddFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveItem: (itemId: string, targetFolderId: string | null) => void;
  onSearchChange: (q: string) => void;
  onTypeFilterChange: (filter: "all" | "note" | "snippet") => void;
}

function Sidebar({
  items,
  folders,
  selectedId,
  selectedFolderId,
  unsavedItemId,
  typeFilter,
  searchQuery,
  searchInputRef,
  onSelect,
  onSelectFolder,
  onNew,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveItem,
  onSearchChange,
  onTypeFilterChange,
}: SidebarProps) {
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderConfirmDeleteId, setFolderConfirmDeleteId] = useState<
    string | null
  >(null);
  const [sortBy, setSortBy] = useState<SortBy>(readSort);

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

  const { dragState, dragOverId, startDrag } = useDragToFolder(onMoveItem);

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
    () => filterItems(items, searchQuery, typeFilter).sort(COMPARE[sortBy]),
    [items, searchQuery, typeFilter, sortBy],
  );

  const unfiledItems = useMemo(
    () => filtered.filter((i) => i.folderId === null),
    [filtered],
  );

  // While searching or filtering, folders without a match disappear and the rest open up
  const isFiltering = searchQuery.trim() !== "" || typeFilter !== "all";

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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onSearchChange("");
      e.currentTarget.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter") {
      // Open the first match if nothing visible is selected, then leave the box so Ctrl+C works
      const visible = treeRef.current?.querySelector(
        `[data-item-id="${selectedId}"]`,
      );
      if (!visible) moveSelection(1);
      e.currentTarget.blur();
    }
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

  // The tree itself is the "unfiled" drop target: folder groups win, empty space and root items unfile
  const isRootDragOver = dragState !== null && dragOverId === null;

  return (
    <aside className="sidebar">
      {/* Header — drag region */}
      <div className="sidebar__header" data-tauri-drag-region>
        <div className="sidebar__brand" data-tauri-drag-region>
          <span aria-hidden="true">⬡</span>
          <span>graphene</span>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar__search">
        <div className="sidebar__search-box">
          <span className="sidebar__search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={searchInputRef}
            className="sidebar__search-input"
            type="text"
            placeholder="search…  (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search items"
          />
        </div>
      </div>

      {/* Type filter pills */}
      <div className="sidebar__filters">
        {(["all", "note", "snippet"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`sidebar__filter-pill${typeFilter === f ? " sidebar__filter-pill--active" : ""}`}
            onClick={() => onTypeFilterChange(f)}
          >
            {f === "note" ? "notes" : f === "snippet" ? "snippets" : "all"}
          </button>
        ))}
      </div>

      {/* Folder + tree section */}
      <div
        ref={treeRef}
        className={`sidebar__folders${isRootDragOver ? " sidebar__folders--drag-over" : ""}`}
        data-folder-drop-id="unfiled"
        role="tree"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a tree is a composite widget; the container takes focus so the arrow keys can move the selection
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
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
              title={`Sorted by ${SORT_LABEL[sortBy]} (click to change)`}
            >
              {SORT_LABEL[sortBy]}
            </button>
            <button
              type="button"
              className="sidebar__folders-add-btn"
              onClick={() => setShowAddFolder((v) => !v)}
              aria-label="Add folder"
              title="Add folder"
            >
              +
            </button>
          </div>
        </div>

        {showAddFolder && (
          <div className="sidebar__folder-add-row">
            <input
              ref={newFolderInputRef}
              className="sidebar__folder-add-input"
              type="text"
              placeholder="folder name…"
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
            depth={0}
            forceExpand={isFiltering}
            onSelect={onSelectFolder}
            onSelectItem={selectItem}
            onItemPointerDown={startDrag}
            onAddSubfolder={handleAddSubfolder}
            onRename={onRenameFolder}
            onDelete={requestDeleteFolder}
          />
        ))}

        {/* Unfiled items — no folder assigned */}
        {unfiledItems.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            isUnsaved={unsavedItemId === item.id}
            onSelect={selectItem}
            onPointerDown={startDrag}
            style={{ paddingLeft: "14px" }}
          />
        ))}

        {filtered.length === 0 && (
          <div className="sidebar__empty">
            {items.length === 0 ? "nothing here yet" : "no results"}
          </div>
        )}
      </div>

      {/* New item button */}
      <div className="sidebar__new-footer">
        <button
          type="button"
          className="sidebar__new-footer-btn"
          onClick={onNew}
          aria-label="New item"
          title="New item (Ctrl+N)"
        >
          <span aria-hidden="true">+</span>
          new item
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
