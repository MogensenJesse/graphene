// src/App.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readFile } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MenuEntry } from "./components/ContextMenu";
import ContextMenuProvider, {
  useContextMenu,
} from "./components/ContextMenuProvider";
import {
  CodeIcon,
  HexagonIcon,
  ListTodoIcon,
  PlusIcon,
  SearchIcon,
} from "./components/Icon";
import NewItemPanel from "./components/NewItemPanel";
import NoteDetail from "./components/NoteDetail";
import SearchPalette from "./components/SearchPalette";
import Sidebar from "./components/Sidebar";
import TrashView from "./components/TrashView";
import UpdateDialog from "./components/UpdateDialog";
import WindowControls from "./components/WindowControls";
import { useFileDrop } from "./hooks/useFileDrop";
import { useFolders } from "./hooks/useFolders";
import type { AddItemFields, UpdateItemFields } from "./hooks/useItems";
import { useItems } from "./hooks/useItems";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useUpdater } from "./hooks/useUpdater";
import { saveImage, VaultPathContext } from "./lib/attachmentStore";
import { extOf } from "./lib/attachments";
import { mergeFolders, mergeItems, sameItem } from "./lib/mergeScan";
import {
  folderAbsPath,
  itemFilePath,
  loadVault,
  writeState,
} from "./lib/storage";
import { moveTask, toggleTaskAt } from "./lib/tasks";
import { getVaultPath, pickVaultPath, setVaultPath } from "./lib/vault";
import type { Item, ItemKind, TypeFilter } from "./types";

type Mode = "new" | "detail" | "edit" | "trash";

const appWindow = getCurrentWindow();

// Coming back to the window rescans the vault, but not more often than this
const REFRESH_MIN_MS = 5000;
// A rescan that overlapped one of our own writes is thrown away and tried again after this
const REFRESH_RETRY_MS = 1500;

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
        <h1 className="vault-picker__title">Graphene</h1>
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
  const { open } = useContextMenu();
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  // Goes up on each Ctrl+F; the open note or editor shows its find bar when it changes
  const [findSignal, setFindSignal] = useState(0);
  const [mode, setMode] = useState<Mode>("new");

  // One "+ new" session: remount key, kind, default folder, and the item "done" returns to
  const [draft, setDraft] = useState<{
    key: number;
    kind: ItemKind;
    folderId: string | null;
    returnToId: string | null;
  }>({ key: 0, kind: "note", folderId: null, returnToId: null });
  const [isDirtyEdit, setIsDirtyEdit] = useState(false);
  // Item the open editor writes to; null = unsaved draft. A ref so a flush before re-render still sees it
  const editingIdRef = useRef<string | null>(null);
  // Set by NewItemPanel: save now if dirty
  const flushRef = useRef<(() => void) | null>(null);

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

  // folderId omitted = wherever the selection is (folder, else the open item's folder); null = no folder
  const handleNew = (kind: ItemKind, folderId?: string | null) => {
    if (mode === "new" && isDirtyEdit) return; // keep a draft that has content
    leaveEditor();
    setDraft((d) => ({
      key: d.key + 1,
      kind,
      folderId:
        folderId !== undefined
          ? folderId
          : (selectedFolderId ?? selectedItem?.folderId ?? null),
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
    onOpenSearch: () => setSearchOpen(true),
    // Find in the open note or editor; with neither on screen (trash), Ctrl+F is search
    onFind: () =>
      mode === "trash" ? setSearchOpen(true) : setFindSignal((n) => n + 1),
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

  // Save a pending edit before the window goes away (close, or the updater's installer)
  const flushPendingSave = useCallback(async () => {
    flushRef.current?.();
    // ponytail: saves are fire-and-forget inside state updaters, so a fixed delay lets the write land.
    // Upgrade to awaiting tracked writes if saves ever get slow.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }, []);

  useEffect(() => {
    const unlisten = appWindow.onCloseRequested(flushPendingSave);
    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, [flushPendingSave]);

  // Notes changed outside Graphene (another editor, Dropbox, git) show up when the window gets focus.
  // The editor copies its note when it opens, so one with unsaved typing keeps its own text (its next
  // autosave wins, as before); a clean one is reopened on what is on disk.
  const isDirtyEditRef = useRef(false);
  useEffect(() => {
    isDirtyEditRef.current = isDirtyEdit;
  }, [isDirtyEdit]);
  const refreshing = useRef(false);
  const lastRefresh = useRef(Date.now());

  const refreshFromDisk = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const before = writeState();
        const scanned = await loadVault(vaultPath);
        const after = writeState();
        if (before.pending || after.pending || before.seq !== after.seq) {
          // A save, move or delete of ours ran during the scan, which may have caught a file mid-move
          await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_MS));
          continue;
        }
        const open = editingIdRef.current;
        const dirty = open !== null && isDirtyEditRef.current;
        if (open && !dirty) {
          const mine = itemsRef.current.find((i) => i.id === open);
          const disk = scanned.items.find((i) => i.id === open);
          if (!disk)
            editingIdRef.current = null; // deleted outside: the editor goes with it
          else if (mine && !sameItem(mine, disk))
            setDraft((d) => ({ ...d, key: d.key + 1 })); // reopen on the new text
        }
        setItems((prev) =>
          mergeItems(prev, scanned.items, dirty ? open : null),
        );
        setTrashed((prev) => mergeItems(prev, scanned.trashed, null));
        setFolders((prev) => mergeFolders(prev, scanned.folders));
        return;
      }
    } catch (err) {
      console.error("[refreshFromDisk]", err);
    } finally {
      refreshing.current = false;
    }
  }, [vaultPath, setItems, setTrashed, setFolders, itemsRef]);

  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused || Date.now() - lastRefresh.current < REFRESH_MIN_MS) return;
      lastRefresh.current = Date.now();
      refreshFromDisk();
    });
    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, [refreshFromDisk]);

  const updater = useUpdater(flushPendingSave);
  const [updateOpen, setUpdateOpen] = useState(false);
  const closeUpdate = useCallback(() => setUpdateOpen(false), []);

  // Dropped files land in the selected folder, and the last one imported opens
  // Pictures dropped on the window are copied into the vault's attachments folder and linked at the
  // cursor of the open editor; with no editor open there is nowhere to put them
  const insertImagesRef = useRef<((files: string[]) => void) | null>(null);
  const handleDropImages = useCallback(
    async (paths: string[]) => {
      if (!insertImagesRef.current) return false;
      const files = await Promise.all(
        paths.map(async (path) =>
          saveImage(vaultPath, await readFile(path), extOf(path)),
        ),
      );
      insertImagesRef.current?.(files);
      return true;
    },
    [vaultPath],
  );

  const { isDraggingOver } = useFileDrop(
    addItem,
    () => selectedFolderId,
    handleSelect,
    handleDropImages,
  );

  const handleDelete = (id: string) => {
    // The editor goes with the item. Left set, the next new draft's first save would update a
    // missing item instead of creating one. Edits typed in the last moment go with the note.
    if (editingIdRef.current === id) editingIdRef.current = null;
    deleteItem(id);
  };

  const handleRename = (id: string, title: string) => {
    updateItem(id, { title });
  };

  // A body edit made from the read view (ticking or moving a task). The offset says which task;
  // `edit` re-checks it against the current text and returns null when it no longer fits.
  const editBody = (id: string, edit: (body: string) => string | null) => {
    const item = itemsRef.current.find((i) => i.id === id);
    const body = item && edit(item.body);
    if (body !== null && body !== undefined) updateItem(id, { body });
  };

  const handleToggleTask = (id: string, offset: number) =>
    editBody(id, (body) => toggleTaskAt(body, offset));

  const handleMoveTask = (
    id: string,
    from: number,
    to: number,
    after: boolean,
  ) => editBody(id, (body) => moveTask(body, from, to, after));

  // Open an item straight in the editor (sidebar menu). The editor may already be open on
  // something else, so bump the key to remount it on this item.
  const handleEditItem = (id: string) => {
    leaveEditor();
    setSelectedId(id);
    setSelectedFolderId(null);
    editingIdRef.current = id;
    setDraft((d) => ({ ...d, key: d.key + 1 }));
    setMode("edit");
  };

  const handleDuplicate = (id: string) => {
    const source = itemsRef.current.find((i) => i.id === id);
    if (!source) return;
    handleSelect(
      addItem({
        title: `${source.title} copy`,
        body: source.body,
        folderId: source.folderId,
      }),
    );
  };

  const handleRevealItem = (item: Item) => {
    revealItemInDir(itemFilePath(vaultPath, item)).catch(console.error);
  };

  const handleRevealFolder = (folderId: string) => {
    revealItemInDir(folderAbsPath(vaultPath, folderId)).catch(console.error);
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
          onToggleTask={handleToggleTask}
          onMoveTask={handleMoveTask}
          findSignal={findSignal}
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
        findSignal={findSignal}
        insertImagesRef={insertImagesRef}
      />
    );
  };

  // Right-click on any part of the window that has no menu of its own
  const appEntries: MenuEntry[] = [
    {
      label: "New note",
      icon: <PlusIcon size={14} />,
      onSelect: () => handleNew("note"),
    },
    {
      label: "New to-do",
      icon: <ListTodoIcon size={14} />,
      onSelect: () => handleNew("todo"),
    },
    {
      label: "New code",
      icon: <CodeIcon size={14} />,
      onSelect: () => handleNew("code"),
    },
    "separator",
    {
      label: "Search",
      icon: <SearchIcon size={14} />,
      onSelect: () => setSearchOpen(true),
    },
  ];

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; every entry has a shortcut or button elsewhere
    <div
      className="app"
      data-tauri-drag-region
      onContextMenu={(e) => open(e, appEntries)}
    >
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
            trashedCount={trashed.length}
            trashOpen={mode === "trash"}
            version={updater.version}
            updateStatus={updater.status}
            updateAvailable={updater.update !== null}
            onCheckUpdates={updater.checkNow}
            onShowUpdate={() => setUpdateOpen(true)}
            editingItemId={mode === "edit" ? selectedId : null}
            onSelect={handleSelect}
            onSelectFolder={handleSelectFolder}
            onNew={handleNew}
            onEditItem={handleEditItem}
            onDuplicateItem={handleDuplicate}
            onDeleteItem={handleDelete}
            onRenameItem={handleRename}
            onRevealItem={handleRevealItem}
            onRevealFolder={handleRevealFolder}
            onOpenTrash={handleOpenTrash}
            onAddFolder={addFolder}
            onRenameFolder={updateFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveItem={moveItem}
            onOpenSearch={() => setSearchOpen(true)}
            onTypeFilterChange={setTypeFilter}
          />
        </div>
        <main className="app__main">
          <div className="app__drag-strip" data-tauri-drag-region />
          <WindowControls />
          {renderMain()}
        </main>
      </div>
      {updateOpen && updater.update && (
        <UpdateDialog
          current={updater.version}
          update={updater.update}
          notes={updater.notes}
          status={updater.status}
          progress={updater.progress}
          error={updater.error}
          canInstall={updater.canInstall}
          onInstall={updater.install}
          onClose={closeUpdate}
        />
      )}
      {searchOpen && (
        <SearchPalette
          items={items}
          folders={folders}
          onOpen={(id) => {
            setSearchOpen(false);
            handleSelect(id);
          }}
          onClose={closeSearch}
        />
      )}
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

  return (
    <ContextMenuProvider>
      {vaultPath === null ? (
        // No vault chosen yet — show picker
        <VaultPicker onVaultSet={handleVaultSet} />
      ) : (
        <VaultPathContext.Provider value={vaultPath}>
          <MainApp vaultPath={vaultPath} />
        </VaultPathContext.Provider>
      )}
    </ContextMenuProvider>
  );
}

export default App;
