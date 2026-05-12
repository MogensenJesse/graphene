// src/components/Sidebar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useDragToFolder } from "../hooks/useDragToFolder";
import { filterItems } from "../lib/search";
import type { Folder, Item } from "../types";
import FolderRow from "./FolderRow";
import ItemRow from "./ItemRow";

interface SidebarProps {
  items: Item[];
  folders: Folder[];
  selectedId: string | null;
  selectedFolderId: string | null;
  typeFilter: "all" | "note" | "snippet";
  searchQuery: string;
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
  typeFilter,
  searchQuery,
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

  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const { dragState, dragOverId, startDrag } = useDragToFolder(onMoveItem);

  useEffect(() => {
    if (showAddFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [showAddFolder]);

  const rootFolders = useMemo(
    () => folders.filter((f) => f.parentId === null),
    [folders],
  );

  // No folder filter — the tree handles folder grouping visually
  const filtered = useMemo(
    () => filterItems(items, searchQuery, typeFilter, null),
    [items, searchQuery, typeFilter],
  );

  const unfiledItems = useMemo(
    () => filtered.filter((i) => i.folderId === null),
    [filtered],
  );

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

  // "All items" row is active drop target when dragOverId is null (unfiled zone)
  const isAllItemsDragOver = dragState !== null && dragOverId === null;

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
            className="sidebar__search-input"
            type="text"
            placeholder="search…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
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
      <div className="sidebar__folders">
        <div className="sidebar__folders-header">
          <span className="sidebar__folders-label">Folders</span>
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

        {/* "All items" row — drop target for unfiling (data-folder-drop-id="unfiled") */}
        <button
          type="button"
          data-folder-drop-id="unfiled"
          className={`sidebar__all-items${selectedFolderId === null ? " sidebar__all-items--active" : ""}${isAllItemsDragOver ? " sidebar__all-items--drag-over" : ""}`}
          onClick={() => onSelectFolder(null)}
        >
          <span aria-hidden="true" className="sidebar__all-items-icon">
            ◈
          </span>
          All items
        </button>

        {rootFolders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            allFolders={folders}
            items={filtered}
            selectedFolderId={selectedFolderId}
            selectedId={selectedId}
            dragOverId={dragOverId}
            depth={0}
            onSelect={onSelectFolder}
            onSelectItem={onSelect}
            onItemPointerDown={startDrag}
            onAddSubfolder={handleAddSubfolder}
            onRename={onRenameFolder}
            onDelete={onDeleteFolder}
          />
        ))}

        {/* Unfiled items — no folder assigned */}
        {unfiledItems.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            onSelect={onSelect}
            onPointerDown={startDrag}
            style={{ paddingLeft: "14px" }}
          />
        ))}

        {filtered.length === 0 && (
          <div className="sidebar__empty">no results</div>
        )}
      </div>

      {/* New item button */}
      <div className="sidebar__new-footer">
        <button
          type="button"
          className="sidebar__new-footer-btn"
          onClick={onNew}
          aria-label="New item"
        >
          <span aria-hidden="true">+</span>
          new
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
