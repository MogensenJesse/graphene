// src/App.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readFile } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchPalette from "./components/dialogs/SearchPalette";
import SettingsDialog, {
  type OpenSettings,
  type SettingsTab,
} from "./components/dialogs/SettingsDialog";
import TrashView from "./components/dialogs/TrashView";
import UpdateDialog from "./components/dialogs/UpdateDialog";
import VaultPicker from "./components/dialogs/VaultPicker";
import VaultUnavailable from "./components/dialogs/VaultUnavailable";
import NoteDetail from "./components/note/NoteDetail";
import NoteEditor from "./components/note/NoteEditor";
import Sidebar, { type SidebarTab } from "./components/sidebar/Sidebar";
import TaskLists from "./components/sidebar/TaskLists";
import TasksPane from "./components/tasks/TasksPane";
import type { MenuEntry } from "./components/ui/ContextMenu";
import ContextMenuProvider, {
  useContextMenu,
} from "./components/ui/ContextMenuProvider";
import {
  CopyIcon,
  ExternalLinkIcon,
  GearIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "./components/ui/Icon";
import { newItemEntries } from "./components/ui/newKinds";
import SidebarToggle from "./components/ui/SidebarToggle";
import UndoToast from "./components/ui/UndoToast";
import WindowControls from "./components/ui/WindowControls";
import { useEscape } from "./hooks/useEscape";
import { useFileDrop } from "./hooks/useFileDrop";
import { useFolders } from "./hooks/useFolders";
import type { AddItemFields, UpdateItemFields } from "./hooks/useItems";
import { useItems } from "./hooks/useItems";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useTaskDrag } from "./hooks/useTaskDrag";
import { useTasks } from "./hooks/useTasks";
import { useUpdater } from "./hooks/useUpdater";
import { useVaultRefresh } from "./hooks/useVaultRefresh";
import { useVaults, type Vaults } from "./hooks/useVaults";
import { saveImage, VaultPathContext } from "./lib/attachmentStore";
import { extOf } from "./lib/paths";
import { readPref, writePref } from "./lib/prefs";
import { folderAbsPath, itemFilePath, loadVault } from "./lib/storage";
import { DEFAULT_LIST_ID, orderedLists, type Task } from "./lib/taskStore";
import { toggleTaskAt } from "./lib/tasks";
import { isTextField } from "./lib/textMenu";
import type { Item, ItemKind } from "./types";

type Mode = "new" | "detail" | "edit" | "trash";

// Below this window width the sidebar starts out hidden, and opens over the note instead of beside it
const COMPACT_QUERY = "(max-width: 799px)";
const SIDEBAR_HIDDEN_KEY = "graphene.sidebarHidden";
const SIDEBAR_TAB_KEY = "graphene.sidebarTab";
const TASK_VIEW_KEY = "graphene.taskView";

const appWindow = getCurrentWindow();

interface MainAppProps {
  vaultPath: string;
  vaults: Vaults;
  updateAvailable: boolean;
  onShowUpdate: () => void;
  /** Set by the open editor: save now if dirty. Owned by App, so the window close and the updater reach it too */
  flushRef: React.RefObject<(() => void) | null>;
  onOpenSettings: OpenSettings;
}

// Everything that belongs to one open vault. App gives it a `key`, so switching vaults starts it fresh:
// lists, selection, drafts and effects all reset.
function MainApp({
  vaultPath,
  vaults,
  updateAvailable,
  onShowUpdate,
  flushRef,
  onOpenSettings,
}: MainAppProps) {
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
        // The note stays in the same folder under a new path, so it keeps its rank (`order` given)
        if (item.folderId === oldId) {
          updateItem(item.id, { folderId: newId, order: item.order }, false);
        } else if (item.folderId?.startsWith(`${oldId}/`)) {
          updateItem(
            item.id,
            {
              folderId: newId + item.folderId.slice(oldId.length),
              order: item.order,
            },
            false,
          );
        }
      }
    },
    [updateItem, itemsRef],
  );

  const {
    folders,
    setFolders,
    addFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
  } = useFolders(vaultPath, handleDeleteCascade, handleRenameCascade);

  // Notes put in a new order: each rank is saved with the note (no new "edited" date); the dragged one
  // may also have landed in another folder
  const handleReorderItems = (
    ranks: Record<string, number>,
    movedId: string,
    folderId: string | null,
  ) => {
    for (const [id, order] of Object.entries(ranks))
      updateItem(id, id === movedId ? { folderId, order } : { order }, false);
  };

  // Load all items + folders + trash from vault on mount. A folder that cannot be opened is shown as such (see
  // renderMain), not as an empty vault: saving into it would create it again.
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadTry, setLoadTry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadTry is the "try again" trigger
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
          setLoadFailed(false);
        },
      )
      .catch((err) => {
        console.error(err);
        setLoadFailed(true);
      });
  }, [vaultPath, loadTry, setItems, setFolders, setTrashed]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  // Goes up on each Ctrl+F; the open note or editor shows its find bar when it changes
  const [findSignal, setFindSignal] = useState(0);
  const [mode, setMode] = useState<Mode>("new");

  // The to-do half of the app: its own sidebar tab, lists and tasks, apart from the notes
  const tasksApi = useTasks(vaultPath);
  const taskDrag = useTaskDrag(tasksApi);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() =>
    readPref(SIDEBAR_TAB_KEY) === "tasks" ? "tasks" : "notes",
  );
  // "my-day", "important" or a list id; a list that is gone shows the default one (see TasksPane)
  const [taskView, setTaskView] = useState(
    () => readPref(TASK_VIEW_KEY) ?? DEFAULT_LIST_ID,
  );
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  // Goes up when "Add a task" should take the focus
  const [addTaskSignal, setAddTaskSignal] = useState(0);
  // The task last deleted, for the Undo toast
  const [taskToast, setTaskToast] = useState<{
    key: number;
    listId: string;
    task: Task;
  } | null>(null);

  // A wide window keeps the sidebar the way the user left it; a small one hides it, and the toggle opens it
  // for as long as the window stays small
  const compact = useMediaQuery(COMPACT_QUERY);
  const [wideHidden, setWideHidden] = useState(
    () => readPref(SIDEBAR_HIDDEN_KEY) === "1",
  );
  const [compactOpen, setCompactOpen] = useState(false);
  // The open sidebar covers the note, so it closes when a note or view is picked, on Escape (unless a field
  // is being typed in) and on a click outside it (the scrim)
  const floating = compact && compactOpen;
  const closeFloating = () => setCompactOpen(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: picking another note or view is the trigger
  useEffect(() => {
    if (compact) setCompactOpen(false);
  }, [compact, selectedId, mode]);
  useEscape(closeFloating, {
    active: floating,
    when: () => !isTextField(document.activeElement),
  });
  const sidebarHidden = compact ? !compactOpen : wideHidden;
  const toggleSidebar = () => {
    if (compact) {
      setCompactOpen((open) => !open);
      return;
    }
    setWideHidden(!wideHidden);
    writePref(SIDEBAR_HIDDEN_KEY, wideHidden ? "0" : "1");
  };
  // A folder picked in the sidebar owns the Del key and asks its question in the sidebar: no folder stays picked
  // while that is out of sight
  useEffect(() => {
    if (sidebarHidden) setSelectedFolderId(null);
  }, [sidebarHidden]);

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
    showNotes();
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
    showNotes();
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

  const showNotes = () => {
    if (sidebarTab === "notes") return;
    setSidebarTab("notes");
    writePref(SIDEBAR_TAB_KEY, "notes");
  };

  const handleTab = (tab: SidebarTab) => {
    if (tab === sidebarTab) return;
    if (tab === "notes") {
      showNotes();
      return;
    }
    // Leaving the notes saves what is being typed. The note comes back in the reading view, a blank draft blank.
    const savedId = leaveEditor();
    setSelectedFolderId(null); // a picked folder would keep the Del key while its row is out of sight
    if (mode === "edit" || mode === "new") {
      if (savedId) {
        setSelectedId(savedId);
        setMode("detail");
      } else {
        setSelectedId(null);
        setMode("new");
        setDraft((d) => ({ ...d, key: d.key + 1 }));
      }
    }
    setSidebarTab("tasks");
    writePref(SIDEBAR_TAB_KEY, "tasks");
  };

  const handleSelectTaskView = (view: string) => {
    setTaskView(view);
    writePref(TASK_VIEW_KEY, view);
    setOpenTaskId(null);
    closeFloating();
  };

  const handleTaskDeleted = (listId: string, task: Task) => {
    setTrashToast(null);
    setTaskToast({ key: Date.now(), listId, task });
  };

  const handleUndoTask = () => {
    const toast = taskToast;
    setTaskToast(null);
    if (toast) tasksApi.restoreTask(toast.listId, toast.task);
  };

  const inTasks = sidebarTab === "tasks";

  // Every task with its list, for Ctrl+K
  const taskEntries = useMemo(
    () =>
      orderedLists(tasksApi.index).flatMap((l) =>
        (tasksApi.tasks[l.id] ?? []).map((task) => ({
          listId: l.id,
          listName: l.name,
          task,
        })),
      ),
    [tasksApi.index, tasksApi.tasks],
  );

  useKeyboardShortcuts({
    mode,
    hasSelection: !!selectedId && !inTasks,
    // In the Tasks tab Ctrl+N goes to the "Add a task" box; there is no code task
    onNew: (kind) =>
      inTasks
        ? kind === "note" && setAddTaskSignal((n) => n + 1)
        : handleNew(kind),
    onEdit: handleEdit,
    onDone: handleDone,
    onOpenSearch: () => setSearchOpen(true),
    // Find in the open note or editor; with neither on screen (trash, tasks), Ctrl+F is search
    onFind: () =>
      mode === "trash" || inTasks
        ? setSearchOpen(true)
        : setFindSignal((n) => n + 1),
    onOpenSettings: () => onOpenSettings(),
    onSwitchTab: () => handleTab(inTasks ? "notes" : "tasks"),
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

  // Notes changed outside Graphene show up when the window gets focus
  useVaultRefresh({
    vaultPath,
    itemsRef,
    setItems,
    setFolders,
    editingIdRef,
    isEditorDirty: isDirtyEdit,
    onReopenEditor: () => setDraft((d) => ({ ...d, key: d.key + 1 })),
  });

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

  // Dropped files land in the selected folder, and the last one imported opens
  const { isDraggingOver } = useFileDrop({
    addItem,
    getFolderId: () => selectedFolderId,
    onImported: handleSelect,
    onImages: handleDropImages,
  });

  // The note last moved to the trash, for the Undo toast
  const [trashToast, setTrashToast] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const closeTrashToast = useCallback(() => setTrashToast(null), []);

  // Every way to delete a note (header menu, Del, sidebar, drag to Trash) lands here: no question asked,
  // the toast offers the way back
  const handleDelete = (id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    // The editor goes with the item. Left set, the next new draft's first save would update a
    // missing item instead of creating one. Edits typed in the last moment go with the note.
    if (editingIdRef.current === id) editingIdRef.current = null;
    deleteItem(id);
    setTaskToast(null);
    setTrashToast({ id, title: item.title });
  };

  const handleUndoDelete = async () => {
    const id = trashToast?.id;
    setTrashToast(null);
    if (!id) return;
    await restoreItem(id);
    if (itemsRef.current.some((i) => i.id === id)) handleSelect(id);
  };

  // The toast's Undo would find nothing once the trash is empty
  const handleEmptyTrash = () => {
    setTrashToast(null);
    emptyTrash();
  };

  const handleRename = (id: string, title: string) => {
    updateItem(id, { title });
  };

  // Ticks the checkbox whose marker starts at `offset` in the note. The offset comes from the page that
  // was drawn, so it is re-checked against the current text: a stale one changes nothing.
  const handleToggleTask = (id: string, offset: number) => {
    const item = itemsRef.current.find((i) => i.id === id);
    const body = item && toggleTaskAt(item.body, offset);
    if (body) updateItem(id, { body });
  };

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

  // The "…" button of the open item, and the end of its right-click menu. A draft that is not saved yet has no item to act on.
  const moreEntries: MenuEntry[] = [
    {
      label: "Duplicate",
      icon: <CopyIcon size={14} />,
      disabled: !selectedItem,
      onSelect: () => {
        if (!selectedId) return;
        flushRef.current?.(); // the copy includes what was typed a moment ago
        handleDuplicate(selectedId);
      },
    },
    {
      label: "Reveal in Explorer",
      icon: <ExternalLinkIcon size={14} />,
      disabled: !selectedItem,
      onSelect: () => selectedItem && handleRevealItem(selectedItem),
    },
    "separator",
    {
      label: "Move to trash",
      icon: <TrashIcon size={14} />,
      danger: true,
      disabled: !selectedItem,
      onSelect: () => selectedId && handleDelete(selectedId),
    },
  ];

  const handleDeleteFolder = useCallback(
    (id: string) => {
      deleteFolder(id, itemsRef.current);
    },
    [deleteFolder, itemsRef],
  );

  const renderMain = () => {
    if (loadFailed) {
      return (
        <VaultUnavailable
          name={vaults.vaults.find((v) => v.path === vaultPath)?.name ?? ""}
          path={vaultPath}
          onRetry={() => setLoadTry((n) => n + 1)}
          onManage={() => onOpenSettings("vaults")}
        />
      );
    }

    if (inTasks) {
      return (
        <TasksPane
          // A vault of its own: switching vaults must not look like every task leaving the list
          key={vaultPath}
          view={taskView}
          api={tasksApi}
          openTaskId={openTaskId}
          onOpenTask={setOpenTaskId}
          onTaskDeleted={handleTaskDeleted}
          addSignal={addTaskSignal}
          onTaskPointerDown={taskDrag.startTask}
        />
      );
    }

    if (mode === "trash") {
      return (
        <TrashView
          trashed={trashed}
          folders={folders}
          onRestore={restoreItem}
          onEmpty={handleEmptyTrash}
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
          findSignal={findSignal}
          deleteKeyEnabled={selectedFolderId === null}
          moreEntries={moreEntries}
        />
      );
    }

    // One element for new + edit: the first save flips mode new -> edit without a remount
    return (
      <NoteEditor
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
        moreEntries={moreEntries}
      />
    );
  };

  // Right-click on any part of the window that has no menu of its own. The Tasks tab has tasks to add, not notes
  const appEntries: MenuEntry[] = [
    ...(inTasks
      ? [
          {
            label: "New task",
            icon: <PlusIcon size={14} />,
            onSelect: () => setAddTaskSignal((n) => n + 1),
          },
        ]
      : newItemEntries(handleNew)),
    "separator",
    {
      label: "Search",
      icon: <SearchIcon size={14} />,
      onSelect: () => setSearchOpen(true),
    },
    {
      label: "Settings",
      icon: <GearIcon size={14} />,
      onSelect: () => onOpenSettings(),
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
        <div
          className={`app__sidebar${compact ? " app__sidebar--float" : ""}${sidebarHidden ? " app__sidebar--hidden" : ""}`}
        >
          <Sidebar
            items={items}
            folders={folders}
            selectedId={selectedId}
            selectedFolderId={selectedFolderId}
            unsavedItemId={
              isDirtyEdit && mode === "edit" && selectedId ? selectedId : null
            }
            trashedCount={trashed.length}
            trashOpen={mode === "trash"}
            tab={sidebarTab}
            onTabChange={handleTab}
            tasksPanel={
              <TaskLists
                api={tasksApi}
                selected={taskView}
                onSelect={handleSelectTaskView}
                onOpenSearch={() => setSearchOpen(true)}
                onListPointerDown={taskDrag.startList}
                onGroupPointerDown={taskDrag.startGroup}
                dragOverId={taskDrag.dragOverId}
              />
            }
            updateAvailable={updateAvailable}
            vaults={vaults}
            onShowUpdate={onShowUpdate}
            editingItemId={mode === "edit" ? selectedId : null}
            onSelect={(id) => {
              handleSelect(id);
              closeFloating();
            }}
            onSelectFolder={handleSelectFolder}
            onNew={handleNew}
            onEditItem={handleEditItem}
            onDuplicateItem={handleDuplicate}
            onDeleteItem={handleDelete}
            onRenameItem={handleRename}
            onRevealItem={handleRevealItem}
            onRevealFolder={handleRevealFolder}
            onOpenTrash={handleOpenTrash}
            onOpenSettings={onOpenSettings}
            onAddFolder={addFolder}
            onRenameFolder={updateFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveItem={moveItem}
            onReorderItems={handleReorderItems}
            onReorderFolders={reorderFolders}
            onOpenSearch={() => setSearchOpen(true)}
          />
        </div>
        <main className="app__main">
          <div className="app__drag-strip" data-tauri-drag-region />
          {compact && (
            // biome-ignore lint/a11y/noStaticElementInteractions: clicking the backdrop is a mouse shortcut for Escape, which useEscape above already covers
            <div
              className={`app__scrim${floating ? " app__scrim--on" : ""}`}
              role="presentation"
              onClick={closeFloating}
            />
          )}
          <SidebarToggle hidden={sidebarHidden} onToggle={toggleSidebar} />
          <WindowControls />
          {renderMain()}
          {trashToast && (
            <UndoToast
              key={trashToast.id}
              message={
                <>
                  Moved &ldquo;
                  <span className="toast__title">
                    {trashToast.title || "Untitled"}
                  </span>
                  &rdquo; to trash
                </>
              }
              onUndo={handleUndoDelete}
              onClose={closeTrashToast}
            />
          )}
          {taskDrag.dragState && (
            <div
              className="drag-ghost"
              style={{ left: taskDrag.dragState.x, top: taskDrag.dragState.y }}
              aria-hidden="true"
            >
              {taskDrag.dragState.label}
            </div>
          )}
          {taskToast && (
            <UndoToast
              key={taskToast.key}
              message={
                <>
                  Deleted &ldquo;
                  <span className="toast__title">{taskToast.task.title}</span>
                  &rdquo;
                </>
              }
              onUndo={handleUndoTask}
              onClose={() => setTaskToast(null)}
            />
          )}
        </main>
      </div>
      {searchOpen && (
        <SearchPalette
          items={items}
          folders={folders}
          tasks={taskEntries}
          onOpen={(id) => {
            setSearchOpen(false);
            handleSelect(id);
          }}
          onOpenTask={(listId, taskId) => {
            setSearchOpen(false);
            handleTab("tasks");
            setTaskView(listId);
            writePref(TASK_VIEW_KEY, listId);
            setOpenTaskId(taskId);
          }}
          onClose={closeSearch}
        />
      )}
    </div>
  );
}

function App() {
  // Set by the open editor: save now if dirty
  const flushRef = useRef<(() => void) | null>(null);
  const flushNow = useCallback(() => flushRef.current?.(), []);
  const vaults = useVaults(flushNow);
  const vaultPath = vaults.active;

  // Save a pending edit before the window goes away (close, or the updater's installer)
  const flushPendingSave = useCallback(async () => {
    flushRef.current?.();
    // ponytail: saves are fire-and-forget (not awaited), so a fixed delay lets the write land.
    // Upgrade to awaiting tracked writes if saves ever get slow.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }, []);

  useEffect(() => {
    const unlisten = appWindow.onCloseRequested(flushPendingSave);
    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, [flushPendingSave]);

  // Up here, not in MainApp: switching vaults remounts that, and the update check must not start over
  const updater = useUpdater(flushPendingSave);

  // Settings lives outside the vault's remount key, so it keeps its place while a vault is switched
  const [settings, setSettings] = useState<{
    tab: SettingsTab;
    message: string | null;
  } | null>(null);
  const openSettings = useCallback<OpenSettings>(
    (tab = "appearance", message) =>
      setSettings({ tab, message: message ?? null }),
    [],
  );
  const closeSettings = useCallback(() => setSettings(null), []);

  // The update dialog opens from the header pill and from Settings > About (which closes first: one dialog at a time)
  const [updateOpen, setUpdateOpen] = useState(false);
  const showUpdate = useCallback(() => {
    setSettings(null);
    setUpdateOpen(true);
  }, []);
  const closeUpdate = useCallback(() => setUpdateOpen(false), []);

  // Still loading
  if (!vaults.ready) return null;

  return (
    <ContextMenuProvider>
      {vaultPath === null ? (
        // No vault yet (first run, or the last one was removed): choose one
        <VaultPicker onChoose={vaults.add} unreadable={vaults.corrupt} />
      ) : (
        <>
          <VaultPathContext.Provider value={vaultPath}>
            <MainApp
              key={vaultPath}
              vaultPath={vaultPath}
              vaults={vaults}
              updateAvailable={updater.update !== null}
              onShowUpdate={showUpdate}
              flushRef={flushRef}
              onOpenSettings={openSettings}
            />
          </VaultPathContext.Provider>
          {settings && (
            <SettingsDialog
              initialTab={settings.tab}
              initialMessage={settings.message}
              updater={updater}
              vaults={vaults}
              onShowUpdate={showUpdate}
              onClose={closeSettings}
            />
          )}
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
        </>
      )}
    </ContextMenuProvider>
  );
}

export default App;
