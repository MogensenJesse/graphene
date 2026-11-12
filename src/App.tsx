// src/App.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HexagonIcon } from "./components/Icon";
import NewItemPanel from "./components/NewItemPanel";
import NoteDetail from "./components/NoteDetail";
import Sidebar from "./components/Sidebar";
import TrashView from "./components/TrashView";
import WindowControls from "./components/WindowControls";
import { useFileDrop } from "./hooks/useFileDrop";
import { useFolders } from "./hooks/useFolders";
import type { AddItemFields, UpdateItemFields } from "./hooks/useItems";
import { useItems } from "./hooks/useItems";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { loadVault } from "./lib/storage";
import { getVaultPath, pickVaultPath, setVaultPath } from "./lib/vault";

type Mode = "new" | "detail" | "edit" | "trash";

const appWindow = getCurrentWindow();

function VaultPicker({ onVaultSet }: { onVaultSet: (path: string) => void }) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChoose = async () => {
    setPicking(true);
    setError(null);
    try {
      const chosen = await pickVaultPath();
      if (chosen) {
        await setVaultPath(chosen);
        onVaultSet(chosen);
      }
    } catch (err) {
      setError("Failed to pick folder. Please try again.");
      console.error("[VaultPicker]", err);
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="vault-picker" data-tauri-drag-region>
      <div className="vault-picker__card">
        <div className="vault-picker__icon" aria-hidden="true">
          <HexagonIcon size={36} />
        </div>
        <h1 className="vault-picker__title">graphene</h1>
        <p className="vault-picker__desc">
          Choose a folder to use as your vault. Notes and snippets will be
          stored as files inside it.
        </p>
        {error && <p className="vault-picker__error">{error}</p>}
        <button
          type="button"
          className="vault-picker__btn"
          onClick={handleChoose}
          disabled={picking}
        >
          {picking ? "Choosing…" : "Choose vault folder"}
        </button>
      </div>
      <WindowControls className="vault-picker__win-controls" />
    </div>
  );
}

function MainApp({ vaultPath }: { vaultPath: string }) {
  const {
    items,
    setItems,
    trashed,
    setTrashed,
    itemsRef,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    restoreItem,
    emptyTrash,
  } = useItems(vaultPath);

  const handleDeleteCascade = useCallback(
    (folderId: string, newParentId: string | null) => {
      for (const item of itemsRef.current) {
        if (
          item.folderId === folderId ||
          item.folderId?.startsWith(`${folderId}/`)
        ) {
          updateItem(item.id, { folderId: newParentId }, false);
        }
      }
    },
    [updateItem, itemsRef],
  );

  const handleRenameCascade = useCallback(
    (oldId: string, newId: string) => {
      for (const item of itemsRef.current) {
        if (item.folderId === oldId) {
          updateItem(item.id, { folderId: newId }, false);
        } else if (item.folderId?.startsWith(`${oldId}/`)) {
          updateItem(
            item.id,
            { folderId: newId + item.folderId.slice(oldId.length) },
            false,
          );
        }
      }
    },
    [updateItem, itemsRef],
  );

  const { folders, setFolders, addFolder, updateFolder, deleteFolder } =
    useFolders(vaultPath, handleDeleteCascade, handleRenameCascade);

  // Load all items + folders + trash from vault on mount
  useEffect(() => {
    loadVault(vaultPath)
      .then(
        ({
          items: loadedItems,
          folders: loadedFolders,
          trashed: loadedTrash,
        }) => {
          setItems(loadedItems);
          setFolders(loadedFolders);
          setTrashed(loadedTrash);
        },
      )
      .catch(console.error);
  }, [vaultPath, setItems, setFolders, setTrashed]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "note" | "code">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<Mode>("new");

  // One "+ new" session: remount key, kind, default folder, and the item "done" returns to
  const [draft, setDraft] = useState<{
    key: number;
    kind: "note" | "code";
    folderId: string | null;
    returnToId: string | null;
  }>({ key: 0, kind: "note", folderId: null, returnToId: null });
  const [isDirtyEdit, setIsDirtyEdit] = useState(false);
  // Item the open editor writes to; null = unsaved draft. A ref so a flush before re-render still sees it
  const editingIdRef = useRef<string | null>(null);
  // Set by NewItemPanel: save now if dirty
  const flushRef = useRef<(() => void) | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedId && !items.some((i) => i.id === selectedId)) {
      setSelectedId(null);
      setMode("new");
      setDraft((d) => ({
        key: d.key + 1,
        kind: "note",
        folderId: null,
        returnToId: null,
      }));
    }
  }, [items, selectedId]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId),
    [items, selectedId],
  );

  /** Save pending edits and detach the editor. Returns the id it was writing to, if any. */
  const leaveEditor = () => {
    flushRef.current?.();
    const id = editingIdRef.current;
    editingIdRef.current = null;
    return id;
  };

  const handleSelect = (id: string) => {
    leaveEditor();
    setSelectedId(id);
    setSelectedFolderId(null);
    setMode("detail");
  };

  // Selecting a folder no longer closes the open item
  const handleSelectFolder = (id: string | null) => {
    setSelectedFolderId(id);
  };

  const handleNew = (kind: "note" | "code") => {
    if (mode === "new" && isDirtyEdit) return; // keep a draft that has content
    leaveEditor();
    setDraft((d) => ({
      key: d.key + 1,
      kind,
      folderId: selectedFolderId ?? selectedItem?.folderId ?? null,
      // Starting over from an empty draft keeps the item it would return to
      returnToId: mode === "new" ? d.returnToId : selectedId,
    }));
    setSelectedId(null);
    setMode("new");
  };

  const handleOpenTrash = () => {
    leaveEditor();
    setSelectedId(null);
    setMode("trash");
  };

  const handleEdit = () => {
    editingIdRef.current = selectedId;
    setMode("edit");
  };

  const handleDone = () => {
    const savedId = leaveEditor();
    const target = savedId ?? draft.returnToId;
    if (!target || !itemsRef.current.some((i) => i.id === target)) return;
    setSelectedId(target);
    setMode("detail");
  };

  useKeyboardShortcuts({
    mode,
    hasSelection: !!selectedId,
    onNew: handleNew,
    onEdit: handleEdit,
    onDone: handleDone,
    onFocusSearch: () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
  });

  // First save of a draft creates the item; later saves update it. The mode flips new -> edit
  // without remounting the editor, so the caret survives.
  const saveFromEditor = useCallback(
    (create: () => string, fields: UpdateItemFields) => {
      if (editingIdRef.current) {
        updateItem(editingIdRef.current, fields);
        return;
      }
      const id = create();
      editingIdRef.current = id;
      setSelectedId(id);
      setSelectedFolderId(null);
      setMode("edit");
    },
    [updateItem],
  );

  const handleSave = useCallback(
    (fields: AddItemFields) => saveFromEditor(() => addItem(fields), fields),
    [saveFromEditor, addItem],
  );

  // Flush a pending edit before the window closes
  useEffect(() => {
    const unlisten = appWindow.onCloseRequested(async () => {
      flushRef.current?.();
      // ponytail: saves are fire-and-forget inside state updaters, so a fixed delay lets the write land.
      // Upgrade to awaiting tracked writes if saves ever get slow.
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, []);

  // Dropped files land in the selected folder, and the last one imported opens
  const { isDraggingOver } = useFileDrop(
    addItem,
    () => selectedFolderId,
    handleSelect,
  );

  const handleDelete = (id: string) => {
    deleteItem(id);
  };

  const handleRename = (id: string, title: string) => {
    updateItem(id, { title });
  };

  const handleDeleteFolder = useCallback(
    (id: string) => {
      deleteFolder(id, itemsRef.current);
    },
    [deleteFolder, itemsRef],
  );

  const renderMain = () => {
    if (mode === "trash") {
      return (
        <TrashView
          trashed={trashed}
          folders={folders}
          onRestore={restoreItem}
          onEmpty={emptyTrash}
        />
      );
    }

    if (mode === "detail" && selectedItem) {
      return (
        <NoteDetail
          note={selectedItem}
          folders={folders}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRename={handleRename}
          onMove={moveItem}
          deleteKeyEnabled={selectedFolderId === null}
        />
      );
    }

    // One element for new + edit: the first save flips mode new -> edit without a remount
    return (
      <NewItemPanel
        key={draft.key}
        folders={folders}
        initialItem={selectedItem}
        newKind={draft.kind}
        defaultFolderId={draft.folderId}
        onSave={handleSave}
        onDirtyChange={setIsDirtyEdit}
        onDone={handleDone}
        canLeave={mode === "edit" || draft.returnToId !== null}
        flushRef={flushRef}
      />
    );
  };

  return (
    <div className="app" data-tauri-drag-region>
      {isDraggingOver && <div className="drop-overlay" aria-hidden="true" />}
      <div className="app__body">
        <div className="app__sidebar">
          <Sidebar
            items={items}
            folders={folders}
            selectedId={selectedId}
            selectedFolderId={selectedFolderId}
            unsavedItemId={
              isDirtyEdit && mode === "edit" && selectedId ? selectedId : null
            }
            typeFilter={typeFilter}
            searchQuery={searchQuery}
            searchInputRef={searchInputRef}
            trashedCount={trashed.length}
            trashOpen={mode === "trash"}
            onSelect={handleSelect}
            onSelectFolder={handleSelectFolder}
            onNew={handleNew}
            onOpenTrash={handleOpenTrash}
            onAddFolder={addFolder}
            onRenameFolder={updateFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveItem={moveItem}
            onSearchChange={setSearchQuery}
            onTypeFilterChange={setTypeFilter}
          />
        </div>
        <main className="app__main">
          <div className="app__drag-strip" data-tauri-drag-region />
          <WindowControls />
          {renderMain()}
        </main>
      </div>
    </div>
  );
}

function App() {
  const [vaultPath, setVaultPathState] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    getVaultPath()
      .then(setVaultPathState)
      .catch(() => setVaultPathState(null));
  }, []);

  const handleVaultSet = (path: string) => {
    setVaultPathState(path);
  };

  // Still loading
  if (vaultPath === undefined) return null;

  // No vault chosen yet — show picker
  if (vaultPath === null) {
    return <VaultPicker onVaultSet={handleVaultSet} />;
  }

  return <MainApp vaultPath={vaultPath} />;
}

export default App;
