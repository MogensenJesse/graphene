// src/App.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NewItemPanel from "./components/NewItemPanel";
import NoteDetail from "./components/NoteDetail";
import Sidebar from "./components/Sidebar";
import SnippetDetail from "./components/SnippetDetail";
import { useFileDrop } from "./hooks/useFileDrop";
import { useFolders } from "./hooks/useFolders";
import type {
  AddNoteFields,
  AddSnippetFields,
  UpdateItemFields,
} from "./hooks/useItems";
import { useItems } from "./hooks/useItems";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { loadVault } from "./lib/storage";
import { getVaultPath, pickVaultPath, setVaultPath } from "./lib/vault";

type Mode = "new" | "detail" | "edit";

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
          ⬡
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
      <div className="app__win-controls vault-picker__win-controls">
        <button
          type="button"
          className="app__win-btn"
          onClick={() => appWindow.minimize()}
          aria-label="Minimize"
          title="Minimize"
        >
          <svg
            width="10"
            height="1"
            viewBox="0 0 10 1"
            fill="none"
            aria-hidden="true"
          >
            <rect width="10" height="1" rx="0.5" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="app__win-btn app__win-btn--close"
          onClick={() => appWindow.close()}
          aria-label="Close"
          title="Close"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1L9 9M9 1L1 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MainApp({ vaultPath }: { vaultPath: string }) {
  const {
    items,
    setItems,
    addNote,
    addSnippet,
    updateItem,
    deleteItem,
    moveItem,
    incrementCopyCount,
  } = useItems(vaultPath);

  // Keep a ref to the latest items so callbacks don't depend on items state
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
    [updateItem],
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
    [updateItem],
  );

  const { folders, setFolders, addFolder, updateFolder, deleteFolder } =
    useFolders(vaultPath, handleDeleteCascade, handleRenameCascade);

  // Load all items + folders from vault on mount
  useEffect(() => {
    loadVault(vaultPath)
      .then(({ items: loadedItems, folders: loadedFolders }) => {
        setItems(loadedItems);
        setFolders(loadedFolders);
      })
      .catch(console.error);
  }, [vaultPath, setItems, setFolders]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "note" | "snippet">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<Mode>("new");

  // One "+ new" session: remount key, default folder, and the item "done" returns to
  const [draft, setDraft] = useState<{
    key: number;
    folderId: string | null;
    returnToId: string | null;
  }>({ key: 0, folderId: null, returnToId: null });
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
      setDraft((d) => ({ key: d.key + 1, folderId: null, returnToId: null }));
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

  const handleNewNote = () => {
    if (mode === "new" && isDirtyEdit) return; // keep a draft that has content
    leaveEditor();
    setDraft((d) => ({
      key: d.key + 1,
      folderId: selectedFolderId ?? selectedItem?.folderId ?? null,
      // Starting over from an empty draft keeps the item it would return to
      returnToId: mode === "new" ? d.returnToId : selectedId,
    }));
    setSelectedId(null);
    setMode("new");
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
    onNew: handleNewNote,
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

  const handleSaveNote = useCallback(
    (fields: AddNoteFields) => saveFromEditor(() => addNote(fields), fields),
    [saveFromEditor, addNote],
  );

  const handleSaveSnippet = useCallback(
    (fields: AddSnippetFields) =>
      saveFromEditor(() => addSnippet(fields), fields),
    [saveFromEditor, addSnippet],
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
    addNote,
    addSnippet,
    () => selectedFolderId,
    handleSelect,
  );

  const handleDelete = (id: string) => {
    deleteItem(id);
  };

  const handleRename = (id: string, title: string) => {
    updateItem(id, { title });
  };

  const handleCopied = (id: string) => {
    incrementCopyCount(id);
  };

  const handleDeleteFolder = useCallback(
    (id: string) => {
      deleteFolder(id, itemsRef.current);
    },
    [deleteFolder],
  );

  const renderMain = () => {
    if (mode === "detail" && selectedItem?.type === "note") {
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

    if (mode === "detail" && selectedItem?.type === "snippet") {
      return (
        <SnippetDetail
          snippet={selectedItem}
          folders={folders}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCopied={handleCopied}
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
        initialNote={selectedItem?.type === "note" ? selectedItem : undefined}
        initialSnippet={
          selectedItem?.type === "snippet" ? selectedItem : undefined
        }
        defaultFolderId={draft.folderId}
        onSaveNote={handleSaveNote}
        onSaveSnippet={handleSaveSnippet}
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
            onSelect={handleSelect}
            onSelectFolder={handleSelectFolder}
            onNew={handleNewNote}
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
          <div className="app__win-controls">
            <button
              type="button"
              className="app__win-btn"
              onClick={() => appWindow.minimize()}
              aria-label="Minimize"
              title="Minimize"
            >
              <svg
                width="10"
                height="1"
                viewBox="0 0 10 1"
                fill="none"
                aria-hidden="true"
              >
                <rect width="10" height="1" rx="0.5" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="app__win-btn app__win-btn--close"
              onClick={() => appWindow.close()}
              aria-label="Close"
              title="Close"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 1L9 9M9 1L1 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
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
