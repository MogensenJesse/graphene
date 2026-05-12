// src/App.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NewItemPanel from "./components/NewItemPanel";
import NoteDetail from "./components/NoteDetail";
import Sidebar from "./components/Sidebar";
import SnippetDetail from "./components/SnippetDetail";
import { useFileDrop } from "./hooks/useFileDrop";
import { useFolders } from "./hooks/useFolders";
import type { AddNoteFields, AddSnippetFields } from "./hooks/useItems";
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

  const { isDraggingOver } = useFileDrop(addNote, addSnippet);

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
          updateItem(item.id, { folderId: newParentId });
        }
      }
    },
    [updateItem],
  );

  const handleRenameCascade = useCallback(
    (oldId: string, newId: string) => {
      for (const item of itemsRef.current) {
        if (item.folderId === oldId) {
          updateItem(item.id, { folderId: newId });
        } else if (item.folderId?.startsWith(`${oldId}/`)) {
          updateItem(item.id, {
            folderId: newId + item.folderId.slice(oldId.length),
          });
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

  useEffect(() => {
    if (selectedId && !items.some((i) => i.id === selectedId)) {
      setSelectedId(null);
      setMode("new");
    }
  }, [items, selectedId]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId),
    [items, selectedId],
  );

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSelectedFolderId(null);
    setMode("detail");
  };

  const handleSelectFolder = (id: string | null) => {
    setSelectedFolderId(id);
    setSelectedId(null);
  };

  const [newPanelDefaultType, setNewPanelDefaultType] = useState<
    "note" | "snippet"
  >("note");

  const handleNewNote = () => {
    setNewPanelDefaultType("note");
    setMode("new");
    setSelectedId(null);
  };

  const handleSaveNewNote = (fields: AddNoteFields) => {
    const newId = addNote(fields);
    setSelectedId(newId);
    setSelectedFolderId(null);
    setMode("detail");
  };

  const handleSaveNewSnippet = (fields: AddSnippetFields) => {
    const newId = addSnippet(fields);
    setSelectedId(newId);
    setSelectedFolderId(null);
    setMode("detail");
  };

  const handleEdit = () => {
    setMode("edit");
  };

  useKeyboardShortcuts(mode, handleNewNote, handleEdit, !!selectedId);

  const [isDirtyEdit, setIsDirtyEdit] = useState(false);

  const handleAutoSaveNote = useCallback(
    (fields: AddNoteFields) => {
      if (mode === "new") {
        const newId = addNote(fields);
        setSelectedId(newId);
        setSelectedFolderId(null);
        setMode("edit");
      } else if (selectedId) {
        updateItem(selectedId, fields);
      }
    },
    [mode, selectedId, addNote, updateItem],
  );

  const handleAutoSaveSnippet = useCallback(
    (fields: AddSnippetFields) => {
      if (mode === "new") {
        const newId = addSnippet(fields);
        setSelectedId(newId);
        setSelectedFolderId(null);
        setMode("edit");
      } else if (selectedId) {
        updateItem(selectedId, fields);
      }
    },
    [mode, selectedId, addSnippet, updateItem],
  );

  const handleSaveEditNote = (fields: AddNoteFields) => {
    if (!selectedId) return;
    updateItem(selectedId, fields);
    setMode("detail");
  };

  const handleSaveEditSnippet = (fields: AddSnippetFields) => {
    if (!selectedId) return;
    updateItem(selectedId, fields);
    setMode("detail");
  };

  const handleCancel = () => {
    setMode(selectedId ? "detail" : "new");
  };

  const handleDelete = (id: string) => {
    deleteItem(id);
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
    if (mode === "new") {
      return (
        <NewItemPanel
          key={newPanelDefaultType}
          folders={folders}
          defaultType={newPanelDefaultType}
          onSaveNote={handleSaveNewNote}
          onSaveSnippet={handleSaveNewSnippet}
          onAutoSaveNote={handleAutoSaveNote}
          onAutoSaveSnippet={handleAutoSaveSnippet}
          onDirtyChange={setIsDirtyEdit}
          onCancel={handleCancel}
        />
      );
    }

    if (mode === "edit" && selectedItem?.type === "note") {
      return (
        <NewItemPanel
          initialNote={selectedItem}
          folders={folders}
          onSaveNote={handleSaveEditNote}
          onSaveSnippet={handleSaveNewSnippet}
          onAutoSaveNote={handleAutoSaveNote}
          onAutoSaveSnippet={handleAutoSaveSnippet}
          onDirtyChange={setIsDirtyEdit}
          onCancel={handleCancel}
        />
      );
    }

    if (mode === "edit" && selectedItem?.type === "snippet") {
      return (
        <NewItemPanel
          initialSnippet={selectedItem}
          folders={folders}
          onSaveNote={handleSaveEditNote}
          onSaveSnippet={handleSaveEditSnippet}
          onAutoSaveNote={handleAutoSaveNote}
          onAutoSaveSnippet={handleAutoSaveSnippet}
          onDirtyChange={setIsDirtyEdit}
          onCancel={handleCancel}
        />
      );
    }

    if (selectedItem?.type === "note") {
      return (
        <NoteDetail
          note={selectedItem}
          folders={folders}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      );
    }

    if (selectedItem?.type === "snippet") {
      return (
        <SnippetDetail
          snippet={selectedItem}
          folders={folders}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCopied={handleCopied}
        />
      );
    }

    return (
      <NewItemPanel
        folders={folders}
        defaultType="note"
        onSaveNote={handleSaveNewNote}
        onSaveSnippet={handleSaveNewSnippet}
        onCancel={handleCancel}
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
            unsavedItemId={isDirtyEdit && mode === "edit" && selectedId ? selectedId : null}
            typeFilter={typeFilter}
            searchQuery={searchQuery}
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
