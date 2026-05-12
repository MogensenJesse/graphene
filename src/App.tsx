// src/App.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useState } from "react";
import NewItemPanel from "./components/NewItemPanel";
import NoteDetail from "./components/NoteDetail";
import Sidebar from "./components/Sidebar";
import SnippetDetail from "./components/SnippetDetail";
import { useFolders } from "./hooks/useFolders";
import { useItems } from "./hooks/useItems";
import {
  loadAllFolders,
  loadAllItems,
} from "./lib/storage";
import { getVaultPath, pickVaultPath, setVaultPath } from "./lib/vault";
import type { NoteItem, SnippetItem } from "./types";

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
        <div className="vault-picker__icon" aria-hidden="true">⬡</div>
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
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none" aria-hidden="true">
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
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
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

  const handleDeleteCascade = useCallback(
    (folderId: string, newParentId: string | null) => {
      for (const item of items) {
        if (item.folderId === folderId) {
          updateItem(item.id, { folderId: newParentId });
        }
      }
    },
    [items, updateItem],
  );

  const { folders, setFolders, addFolder, updateFolder, deleteFolder } =
    useFolders(vaultPath, handleDeleteCascade);

  // Load all items + folders from vault on mount
  useEffect(() => {
    Promise.all([
      loadAllItems(vaultPath),
      loadAllFolders(vaultPath),
    ])
      .then(([loadedItems, loadedFolders]) => {
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

  const handleSaveNewNote = (
    fields: Omit<NoteItem, "id" | "type" | "createdAt" | "updatedAt">,
  ) => {
    const newId = addNote(fields);
    setSelectedId(newId);
    setSelectedFolderId(null);
    setMode("detail");
  };

  const handleSaveNewSnippet = (
    fields: Omit<
      SnippetItem,
      "id" | "type" | "createdAt" | "updatedAt" | "copies"
    >,
  ) => {
    const newId = addSnippet(fields);
    setSelectedId(newId);
    setSelectedFolderId(null);
    setMode("detail");
  };

  const handleEdit = () => {
    setMode("edit");
  };

  const handleSaveEditNote = (
    fields: Omit<NoteItem, "id" | "type" | "createdAt" | "updatedAt">,
  ) => {
    if (!selectedId) return;
    updateItem(selectedId, fields);
    setMode("detail");
  };

  const handleSaveEditSnippet = (
    fields: Omit<
      SnippetItem,
      "id" | "type" | "createdAt" | "updatedAt" | "copies"
    >,
  ) => {
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

  const handleMoveItem = useCallback(
    (itemId: string, targetFolderId: string | null) => {
      moveItem(itemId, targetFolderId);
    },
    [moveItem],
  );

  const handleCopied = (id: string) => {
    incrementCopyCount(id);
  };

  const handleDeleteFolder = useCallback(
    (id: string) => {
      deleteFolder(id, items);
    },
    [deleteFolder, items],
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
      <div className="app__body">
        <div className="app__sidebar">
          <Sidebar
            items={items}
            folders={folders}
            selectedId={selectedId}
            selectedFolderId={selectedFolderId}
            typeFilter={typeFilter}
            searchQuery={searchQuery}
            onSelect={handleSelect}
            onSelectFolder={handleSelectFolder}
            onNew={handleNewNote}
            onAddFolder={addFolder}
            onRenameFolder={updateFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveItem={handleMoveItem}
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
