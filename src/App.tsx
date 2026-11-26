// src/App.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { readFile } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  lazy,
  memo,
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  OpenSettings,
  SettingsTab,
} from "./components/dialogs/SettingsDialog";
import TrashView from "./components/dialogs/TrashView";
import VaultMissingBar from "./components/dialogs/VaultMissingBar";
import VaultPicker from "./components/dialogs/VaultPicker";
import VaultUnavailable from "./components/dialogs/VaultUnavailable";
import NoteDetail from "./components/note/NoteDetail";
import NoteEditor from "./components/note/NoteEditor";
import NotePending from "./components/note/NotePending";
import Sidebar, { type SidebarTab } from "./components/sidebar/Sidebar";
import TaskLists from "./components/sidebar/TaskLists";
import { commitTaskFields } from "./components/tasks/TaskDetail";
import TasksPane from "./components/tasks/TasksPane";
import type { MenuEntry } from "./components/ui/ContextMenu";
import ContextMenuProvider, {
  useContextMenu,
} from "./components/ui/ContextMenuProvider";
import DragGhost from "./components/ui/DragGhost";
import ErrorToast from "./components/ui/ErrorToast";
import HeaderActions from "./components/ui/HeaderActions";
import {
  ClipboardIcon,
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
import { useStable } from "./hooks/useLatest";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useRowItems } from "./hooks/useRowItems";
import { useTaskDrag } from "./hooks/useTaskDrag";
import { useTasks } from "./hooks/useTasks";
import { useUpdater } from "./hooks/useUpdater";
import { useVaultRefresh } from "./hooks/useVaultRefresh";
import { useVaults, type Vaults } from "./hooks/useVaults";
import { saveImage, VaultPathContext } from "./lib/attachmentStore";
import { conflictCopyTitle } from "./lib/editConflict";
import { DROP_HINT, DROP_HINT_PICTURES, DROP_HINT_TASKS } from "./lib/fileDrop";
import type { RestorePlan } from "./lib/folderOps";
import { leaveGate } from "./lib/leaveGate";
import { sameItem } from "./lib/mergeScan";
import { extOf, nativePath } from "./lib/paths";
import { perfMark, perfMarkAfterPaint, perfRender } from "./lib/perf";
import { IS_ANDROID } from "./lib/platform";
import { readPref, writePref } from "./lib/prefs";
import { reportError, reportNotice } from "./lib/reportError";
import { restoreNotice } from "./lib/restoreNotice";
import {
  folderAbsPath,
  itemFilePath,
  loadVault,
  writeState,
} from "./lib/storage";
import { DEFAULT_LIST_ID, orderedLists, type Task } from "./lib/taskStore";
import { toggleTaskAt } from "./lib/tasks";
import { isTextField } from "./lib/textMenu";
import { shownWhenGone, type VaultShown } from "./lib/vaultGone";
import { showWindow } from "./lib/windowShow";
import type { Item, ItemKind } from "./types";

// Dialogs that open on demand are scripts of their own, so they are not in the first one; the first open waits for one small file
const SearchPalette = lazy(() => import("./components/dialogs/SearchPalette"));
const SettingsDialog = lazy(
  () => import("./components/dialogs/SettingsDialog"),
);
const UpdateDialog = lazy(() => import("./components/dialogs/UpdateDialog"));

type Mode = "new" | "detail" | "edit" | "trash";

// Below this window width the sidebar starts out hidden, and opens over the note instead of beside it
const COMPACT_QUERY = "(max-width: 799px)";
const SIDEBAR_HIDDEN_KEY = "graphene.sidebarHidden";
const SIDEBAR_TAB_KEY = "graphene.sidebarTab";
const TASK_VIEW_KEY = "graphene.taskView";
// The longest the window waits for pending writes before it closes (or the updater installs)
const FLUSH_CAP_MS = 2000;

const appWindow = getCurrentWindow();

interface MainAppProps {
  vaultPath: string;
  vaults: Vaults;
  updateAvailable: boolean;
  onShowUpdate: () => void;
  /** Set by MainApp: save the editor, commit a task field being typed in, and wait for the writes; resolves false when a note could not be saved (`leaving`: the window is going away, so failed notes are tried again first). Owned by App, so the window close and the updater reach it too */
  flushRef: React.RefObject<((leaving?: boolean) => Promise<boolean>) | null>;
  onOpenSettings: OpenSettings;
}

// Everything that belongs to one open vault. App gives it a `key`, so switching vaults starts it fresh:
// lists, selection, drafts and effects all reset.
//
// Renders: this component renders for every change of the notes, a batch of texts included, so
// what it hands to the big children (Sidebar, NoteDetail, NoteEditor, TasksPane, TaskLists) must be the same values while nothing in
// them changed: data that keeps its identity (`useRowItems`, the memoised `tasksApi`, `vaults`) and functions made with `useStable`
// (or `useCallback`), which keep theirs and run the newest code. The children are `memo`.
function MainApp({
  vaultPath,
  vaults,
  updateAvailable,
  onShowUpdate,
  flushRef,
  onOpenSettings,
}: MainAppProps) {
  perfRender("MainApp");
  const { open } = useContextMenu();
  const {
    items,
    setItems,
    trashed,
    itemsRef,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    restoreItem,
    deleteForever,
    emptyTrash,
    landed,
    unsaved,
    settled: notesSettled,
    adoptScan,
    scanned,
    files,
    loadBodies,
    indexing,
    loadTrashList,
    trashLoaded,
    trashCount,
  } = useItems(vaultPath);
  // What the sidebar draws its rows from: the same array and objects while no row looks different, so a batch of texts does not
  // render it. The note itself, text included, is asked for by id (a menu that copies it)
  const rows = useRowItems(items);
  const getNote = useCallback(
    (id: string) => itemsRef.current.find((i) => i.id === id),
    [itemsRef],
  );

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

  // The Undo of a folder delete: each note still where the delete put it goes back to its folder, with its rank
  const handleRestoreNotes = useCallback(
    (moves: RestorePlan["moves"]) => {
      for (const m of moves)
        updateItem(m.id, { folderId: m.folderId, order: m.order }, false);
    },
    [updateItem],
  );

  const {
    folders,
    setFolders,
    addFolder,
    updateFolder,
    deleteFolder,
    restoreFolder,
    moveFolder,
    reorderFolders,
  } = useFolders(
    vaultPath,
    handleDeleteCascade,
    handleRenameCascade,
    handleRestoreNotes,
  );

  // Notes put in a new order: each rank is saved with the note (no new "edited" date); the dragged one
  // may also have landed in another folder
  const handleReorderItems = useStable(
    (
      ranks: Record<string, number>,
      movedId: string,
      folderId: string | null,
    ) => {
      for (const [id, order] of Object.entries(ranks))
        updateItem(id, id === movedId ? { folderId, order } : { order }, false);
    },
  );

  // List the vault from the Rust scan on mount: every note without its text, so the sidebar paints at once; the texts follow in the
  // background (useBodies) and the trash is only counted (it is listed when its view opens). A folder that cannot be opened is shown
  // as such (see renderMain), not as an empty vault: saving into it would create it again.
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadTry, setLoadTry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadTry is the "try again" trigger
  useEffect(() => {
    loadVault(vaultPath)
      .then((scan) => {
        adoptScan(scan);
        setFolders(scan.folders);
        setLoadFailed(false);
        perfMark("items-set");
      })
      .catch((err) => {
        console.error(err);
        setLoadFailed(true);
      });
  }, [vaultPath, loadTry, adoptScan, setFolders]);
  useEffect(() => {
    if (items.length) perfMarkAfterPaint("first-populated-paint");
  }, [items]);
  // The window starts hidden (see windowShow.ts): this vault's first screen is committed, the list or VaultUnavailable
  useEffect(() => {
    if (scanned || loadFailed) showWindow();
  }, [scanned, loadFailed]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  // The palette is a script of its own that the first open waits for. In a transition the old screen stays until it is there; as a plain
  // update React shows the (empty) Suspense fallback and then holds the content back for 300 ms (its fallback throttle).
  const openSearch = useCallback(
    () => startTransition(() => setSearchOpen(true)),
    [],
  );
  // Goes up on each Ctrl+F; the open note or editor shows its find bar when it changes
  const [findSignal, setFindSignal] = useState(0);
  const [mode, setMode] = useState<Mode>("new");

  // The to-do half of the app: its own sidebar tab, lists and tasks, apart from the notes
  const tasksApi = useTasks(vaultPath);
  const taskDrag = useTaskDrag(tasksApi);

  // The one flush App calls before the window closes, the vault changes or the updater installs. The open editor
  // registers its own save in editorFlush; a task field commits when it loses the focus, so it is made to; then it
  // waits for the writes of notes and tasks (each reports its own failure). `leaving` (the window closes or the
  // updater installs) also tries once more the notes whose write failed earlier: one that fails again shows its
  // toast again (a failed task write is not run again, its old change could land over a newer one: its toast is shown
  // again). It resolves false while a note or a task write is still not saved.
  const editorFlush = useRef<(() => void) | null>(null);
  const tasksSettled = tasksApi.settled;
  const tasksUnsaved = tasksApi.unsaved;
  useEffect(() => {
    flushRef.current = async (leaving = false) => {
      editorFlush.current?.();
      commitTaskFields();
      if (leaving) {
        for (const retry of [...unsaved.values()]) retry();
        for (const tell of [...tasksUnsaved.values()]) tell();
      }
      await Promise.all([notesSettled(), tasksSettled()]);
      return unsaved.size === 0 && tasksUnsaved.size === 0;
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, notesSettled, tasksSettled, unsaved, tasksUnsaved]);

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
  // What was last deleted (a task, a to-do list or group, a folder), for the Undo toast: `what` is the word before its name
  // ("the list "), and `undo` puts it back
  const [undoToast, setUndoToast] = useState<{
    key: number;
    what: string;
    title: string;
    undo: () => void;
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
  const closeFloating = useCallback(() => setCompactOpen(false), []);
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
  // A folder that is deleted or renamed is no longer the picked one: its old id would keep the Del key and
  // send the next new note to a folder that is gone
  useEffect(() => {
    if (selectedFolderId && !folders.some((f) => f.id === selectedFolderId))
      setSelectedFolderId(null);
  }, [folders, selectedFolderId]);

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

  const handleSelect = useStable((id: string) => {
    showNotes();
    leaveEditor();
    setSelectedId(id);
    setSelectedFolderId(null);
    setMode("detail");
  });

  // Selecting a folder no longer closes the open item
  const handleSelectFolder = useStable((id: string | null) => {
    setSelectedFolderId(id);
  });

  // folderId omitted = wherever the selection is (folder, else the open item's folder); null = no folder
  const handleNew = useStable((kind: ItemKind, folderId?: string | null) => {
    if (loadFailed) return; // a vault that cannot be opened takes no new note (the buttons are off too)
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
  });

  // The note that was open when the Trash view opened, for Escape to go back to
  const trashReturnId = useRef<string | null>(null);
  const handleOpenTrash = useStable(() => {
    const from = leaveEditor() ?? selectedId;
    if (mode !== "trash") trashReturnId.current = from;
    setSelectedId(null);
    setMode("trash");
    loadTrashList(); // the list is read the first time the view opens
  });

  // Escape in the Trash view: back to the note that was open (its reading view), or a blank draft when there was none or it is gone
  const handleLeaveTrash = useStable(() => {
    if (floating) return; // the open sidebar takes this Escape (closeFloating)
    const id = trashReturnId.current;
    trashReturnId.current = null;
    if (id && itemsRef.current.some((i) => i.id === id)) {
      setSelectedId(id);
      setMode("detail");
      return;
    }
    setSelectedId(null);
    setMode("new");
    setDraft((d) => ({
      key: d.key + 1,
      kind: "note",
      folderId: null,
      returnToId: null,
    }));
  });

  // The Restore of the Trash view says where the note went; the Undo toast's own restore opens the note instead
  const handleRestore = useStable(async (id: string) => {
    const was = trashed.find((i) => i.id === id);
    const restored = await restoreItem(id);
    if (was && restored)
      reportNotice(restoreNotice(was.title, was.folderId, restored.folderId));
  });

  const handleEdit = useStable(() => {
    editingIdRef.current = selectedId;
    setMode("edit");
  });

  const handleDone = useStable(() => {
    const savedId = leaveEditor();
    const target = savedId ?? draft.returnToId;
    if (!target || !itemsRef.current.some((i) => i.id === target)) return;
    setSelectedId(target);
    setMode("detail");
  });

  const showNotes = () => {
    if (sidebarTab === "notes") return;
    setSidebarTab("notes");
    writePref(SIDEBAR_TAB_KEY, "notes");
  };

  const handleTab = useStable((tab: SidebarTab) => {
    if (tab === sidebarTab) return;
    if (tab === "notes") {
      // Ctrl+Shift+T leaves a task field with the caret in it, and the pane unmounts: commit what was typed first
      flushRef.current?.();
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
  });

  const handleSelectTaskView = useStable((view: string) => {
    setTaskView(view);
    writePref(TASK_VIEW_KEY, view);
    setOpenTaskId(null);
    closeFloating();
  });

  // One Undo bar at a time: the newest delete replaces the last one
  const showUndo = useStable(
    (what: string, title: string, undo: () => void) => {
      setTrashToast(null);
      setUndoToast({ key: Date.now(), what, title, undo });
    },
  );

  const handleTaskDeleted = useStable((listId: string, task: Task) =>
    showUndo("", task.title, () => tasksApi.restoreTask(listId, task)),
  );

  const handleUndo = () => {
    const toast = undoToast;
    setUndoToast(null);
    toast?.undo();
  };

  const inTasks = sidebarTab === "tasks";

  // The Tasks tab's lists, as one element that stays the same until a prop of it changes (Sidebar is memoised and takes it as a prop)
  const tasksPanel = useMemo(
    () => (
      <TaskLists
        api={tasksApi}
        selected={taskView}
        onSelect={handleSelectTaskView}
        onOpenSearch={openSearch}
        onDeleted={showUndo}
        onListPointerDown={taskDrag.startList}
        onGroupPointerDown={taskDrag.startGroup}
        drag={taskDrag.drag}
      />
    ),
    [
      tasksApi,
      taskView,
      handleSelectTaskView,
      openSearch,
      showUndo,
      taskDrag.startList,
      taskDrag.startGroup,
      taskDrag.drag,
    ],
  );

  // The sidebar picks a note: the open sidebar covers the note, so it closes
  const handlePick = useStable((id: string) => {
    handleSelect(id);
    closeFloating();
  });

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

  // New, from Ctrl+N and from the buttons beside the sidebar toggle. In the Tasks tab it goes to the "Add a task" box; there is no code
  // task. Nothing is started in a vault that cannot be opened
  const startNew = useStable((kind: ItemKind) => {
    if (loadFailed) return;
    if (!inTasks) handleNew(kind);
    else if (kind === "note") setAddTaskSignal((n) => n + 1);
  });

  useKeyboardShortcuts({
    mode,
    hasSelection: !!selectedId && !inTasks,
    onNew: startNew,
    onEdit: handleEdit,
    onDone: handleDone,
    onOpenSearch: openSearch,
    // Find in the open note or editor; with neither on screen (trash, tasks), Ctrl+F is search
    onFind: () =>
      mode === "trash" || inTasks ? openSearch() : setFindSignal((n) => n + 1),
    onOpenSettings: () => onOpenSettings(),
    onSwitchTab: () => handleTab(inTasks ? "notes" : "tasks"),
  });

  // First save of a draft creates the item; later saves update it. The mode flips new -> edit
  // without remounting the editor, so the caret survives. Resolves false when the write failed, so the editor
  // keeps its unsaved dot.
  const saveFromEditor = useCallback(
    (create: () => string, fields: UpdateItemFields) => {
      if (editingIdRef.current) {
        const id = editingIdRef.current;
        updateItem(id, fields);
        return landed(id);
      }
      const id = create();
      editingIdRef.current = id;
      setSelectedId(id);
      setSelectedFolderId(null);
      setMode("edit");
      return landed(id);
    },
    [updateItem, landed],
  );

  const handleSave = useCallback(
    (fields: AddItemFields) => saveFromEditor(() => addItem(fields), fields),
    [saveFromEditor, addItem],
  );

  // The open note was changed on disk while the editor holds typing that is not saved: their version of it, until the person
  // chooses (lib/editConflict). The editor holds its autosave meanwhile and shows the bar. Every way out takes their version as the
  // note, so later saves are made against the file that is there, and the editor's text is never lost: Keep mine saves it over the
  // file, Load theirs or leaving with the question open (the editor's flush) puts it in a copy note first, where there is typing
  const [conflict, setConflict] = useState<Item | null>(null);
  const handleConflict = useStable((theirs: Item | null) =>
    setConflict((prev) =>
      prev && theirs && prev.id === theirs.id && sameItem(prev, theirs)
        ? prev
        : theirs,
    ),
  );
  const adoptTheirs = () => {
    const theirs = conflict;
    if (!theirs) return null;
    setConflict(null);
    setItems((prev) => prev.map((i) => (i.id === theirs.id ? theirs : i)));
    return theirs;
  };
  const handleKeepMine = useStable(() => {
    adoptTheirs();
  });
  const handleTakeTheirs = useStable((copy: AddItemFields | null) => {
    if (!adoptTheirs()) return;
    // The copy goes through the normal save path, a note of its own beside the file's version; the editor reopens on that version
    if (copy) addItem({ ...copy, title: conflictCopyTitle(copy.title) });
    setDraft((d) => ({ ...d, key: d.key + 1 }));
  });

  // The vault folder disappeared while it is open (the rescan found out): VaultUnavailable when nothing would be lost, else the lists and
  // the editor stay and a bar says so until the folder is back (lib/vaultGone)
  const [vaultMissing, setVaultMissing] = useState(false);
  const handleVaultGone = useStable(() => {
    const field = document.activeElement;
    const shown: VaultShown = loadFailed
      ? "unavailable"
      : vaultMissing
        ? "notice"
        : "ok";
    const next = shownWhenGone(shown, {
      editorDirty: isDirtyEdit,
      failedNotes: unsaved.size,
      failedTasks: tasksUnsaved.size,
      writing: writeState().pending > 0,
      taskFieldOpen:
        isTextField(field) && field.closest(".tasks-pane") !== null,
    });
    if (next === "notice") setVaultMissing(true);
    else if (next === "unavailable" && shown === "ok") {
      // As after a vault that could not be loaded at start: no lists, VaultUnavailable, and the next focus loads the vault again
      editingIdRef.current = null; // nothing is open to write to
      adoptScan({ items: [], folders: [], trashCount: 0, files: new Map() });
      setFolders([]);
      setLoadFailed(true);
    }
  });
  // The folder is back: the bar goes, and the notes whose save failed are saved now (what their Retry does)
  const handleVaultBack = useStable(() => {
    setVaultMissing(false);
    for (const retry of [...unsaved.values()]) retry();
  });

  // Notes changed outside Graphene show up when the window gets focus, and a change to the open note while it stays focused
  const refreshVault = useVaultRefresh({
    vaultPath,
    itemsRef,
    setItems,
    setFolders,
    editingIdRef,
    isEditorDirty: isDirtyEdit,
    unsaved,
    onReopenEditor: () => setDraft((d) => ({ ...d, key: d.key + 1 })),
    onConflict: handleConflict,
    files,
    ready: scanned,
    unavailable: loadFailed,
    missing: vaultMissing,
    onVaultGone: handleVaultGone,
    onVaultBack: handleVaultBack,
    onRetryLoad: () => setLoadTry((n) => n + 1),
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

  // Dropped files land in the selected folder, and the last one imported opens. Not into a vault that cannot be opened (an empty id
  // is no import: useFileDrop opens only a real one)
  const addDropped = useStable((fields: AddItemFields) =>
    loadFailed ? "" : addItem(fields),
  );
  const { isDraggingOver } = useFileDrop({
    addItem: addDropped,
    getFolderId: () => selectedFolderId,
    // The Tasks tab imports nothing: a note made there would land in a tab nobody is looking at, and the app would switch tabs
    canImport: () => !inTasks,
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
  const handleDelete = useStable((id: string) => {
    // A question about an outside change is open on this note: keep the editor's text as a copy first, and trash their version
    if (conflict?.id === id) editorFlush.current?.();
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    // The editor goes with the item. Left set, the next new draft's first save would update a
    // missing item instead of creating one. Edits typed in the last moment go with the note.
    if (editingIdRef.current === id) editingIdRef.current = null;
    // A failed trash puts the note back (and says so), so its Undo has nothing to undo
    deleteItem(id).then((trashed) => {
      if (!trashed) setTrashToast((t) => (t?.id === id ? null : t));
    });
    setUndoToast(null);
    setTrashToast({ id, title: item.title });
  });

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

  const handleRename = useStable((id: string, title: string) => {
    updateItem(id, { title });
  });

  // Ticks the checkbox whose marker starts at `offset` in the note. The offset comes from the page that
  // was drawn, so it is re-checked against the current text: a stale one changes nothing.
  const handleToggleTask = useStable((id: string, offset: number) => {
    const item = itemsRef.current.find((i) => i.id === id);
    const body = item && toggleTaskAt(item.body, offset);
    if (body) updateItem(id, { body });
  });

  // Open an item straight in the editor (sidebar menu). The editor may already be open on
  // something else, so bump the key to remount it on this item.
  const handleEditItem = useStable((id: string) => {
    leaveEditor();
    setSelectedId(id);
    setSelectedFolderId(null);
    editingIdRef.current = id;
    setDraft((d) => ({ ...d, key: d.key + 1 }));
    setMode("edit");
  });

  const handleDuplicate = useStable((id: string) => {
    const copyOf = (source: Item) =>
      handleSelect(
        addItem({
          title: `${source.title} copy`,
          body: source.body,
          folderId: source.folderId,
        }),
      );
    const source = itemsRef.current.find((i) => i.id === id);
    if (!source) return;
    if (!source.unloaded) return copyOf(source);
    // Its text has not been read yet: a copy made now would be empty
    loadBodies([id]).then(
      () => {
        const read = itemsRef.current.find((i) => i.id === id);
        if (read && !read.unloaded) copyOf(read);
      },
      (err) => reportError(`Could not duplicate "${source.title}"`, err),
    );
  });

  const handleRevealItem = useStable((item: Item) => {
    revealItemInDir(itemFilePath(vaultPath, item)).catch(console.error);
  });

  const handleRevealFolder = useStable((folderId: string) => {
    revealItemInDir(folderAbsPath(vaultPath, folderId)).catch(console.error);
  });

  // The absolute path, as Windows writes it, for pasting into Explorer, a terminal or a message
  const handleCopyItemPath = useStable((item: Item) => {
    writeText(nativePath(itemFilePath(vaultPath, item))).catch(console.error);
  });

  const handleCopyFolderPath = useStable((folderId: string) => {
    writeText(nativePath(folderAbsPath(vaultPath, folderId))).catch(
      console.error,
    );
  });

  // The "…" button of the open item, and the end of its right-click menu. A draft that is not saved yet has no item to act on.
  const moreEntries = useMemo<MenuEntry[]>(
    () => [
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
        label: "Show in Explorer",
        icon: <ExternalLinkIcon size={14} />,
        disabled: !selectedItem,
        onSelect: () => selectedItem && handleRevealItem(selectedItem),
      },
      {
        label: "Copy path",
        icon: <ClipboardIcon size={14} />,
        disabled: !selectedItem,
        onSelect: () => selectedItem && handleCopyItemPath(selectedItem),
      },
      "separator",
      {
        label: "Move to trash",
        icon: <TrashIcon size={14} />,
        keys: "Del",
        danger: true,
        disabled: !selectedItem,
        onSelect: () => selectedId && handleDelete(selectedId),
      },
    ],
    [
      selectedItem,
      selectedId,
      flushRef,
      handleDuplicate,
      handleRevealItem,
      handleCopyItemPath,
      handleDelete,
    ],
  );

  // Renaming or deleting a folder moves the files under it and then rewrites every note in it, so their texts are read first, while
  // they are still where the scan found them; if one cannot be read the folder is left as it is
  const idsInFolder = useCallback(
    (folderId: string) =>
      itemsRef.current
        .filter(
          (i) =>
            i.folderId === folderId || i.folderId?.startsWith(`${folderId}/`),
        )
        .map((i) => i.id),
    [itemsRef],
  );

  // Once the delete has happened on the disk, the Undo bar offers to bring the folder, its subfolders and every note back
  const handleDeleteFolder = useCallback(
    (id: string) => {
      loadBodies(idsInFolder(id)).then(
        async () => {
          const snapshot = await deleteFolder(id, itemsRef.current);
          if (snapshot)
            showUndo("the folder ", snapshot.folders[0].name, () =>
              restoreFolder(snapshot, () => itemsRef.current),
            );
        },
        (err) =>
          reportError(
            `Could not delete the folder "${id.slice(id.lastIndexOf("/") + 1)}"`,
            err,
          ),
      );
    },
    [deleteFolder, restoreFolder, showUndo, itemsRef, loadBodies, idsInFolder],
  );

  // A folder under another parent: the notes under it are rewritten (their picture links take the new depth), so their texts are read first
  const handleMoveFolder = useCallback(
    (id: string, parentId: string | null) => {
      loadBodies(idsInFolder(id)).then(
        () => moveFolder(id, parentId),
        (err) =>
          reportError(
            `Could not move the folder "${id.slice(id.lastIndexOf("/") + 1)}"`,
            err,
          ),
      );
    },
    [moveFolder, loadBodies, idsInFolder],
  );

  const handleRenameFolder = useCallback(
    (id: string, name: string) => {
      loadBodies(idsInFolder(id)).then(
        () => updateFolder(id, name),
        (err) =>
          reportError(
            `Could not rename the folder "${id.slice(id.lastIndexOf("/") + 1)}"`,
            err,
          ),
      );
    },
    [updateFolder, loadBodies, idsInFolder],
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
          onSelectView={handleSelectTaskView}
          onListDeleted={showUndo}
          addSignal={addTaskSignal}
          onTaskPointerDown={taskDrag.startTask}
        />
      );
    }

    if (mode === "trash") {
      // The trash is listed when its view opens (see useItems), a moment of reading the folder
      if (!trashLoaded)
        return (
          <p className="pane-pending" role="status">
            Loading…
          </p>
        );
      return (
        <TrashView
          trashed={trashed}
          folders={folders}
          onRestore={handleRestore}
          onDeleteForever={deleteForever}
          onEmpty={handleEmptyTrash}
          onLeave={handleLeaveTrash}
        />
      );
    }

    // A note whose text has not been read yet is neither shown nor edited: its empty body would pass for the text of the note
    // (and the editor would save it). NotePending reads it now, ahead of the background load, and this gives way once it is in.
    if ((mode === "detail" || mode === "edit") && selectedItem?.unloaded) {
      return (
        <NotePending
          key={selectedItem.id}
          id={selectedItem.id}
          load={loadBodies}
        />
      );
    }

    if (mode === "detail" && selectedItem) {
      // A picked folder takes Del only while the tree has the focus, and stops the key there (useDeleteConfirm),
      // so the note's Del handler can stay on
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
          deleteKeyEnabled
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
        flushRef={editorFlush}
        findSignal={findSignal}
        insertImagesRef={insertImagesRef}
        moreEntries={moreEntries}
        conflict={conflict !== null && conflict.id === selectedItem?.id}
        onKeepMine={handleKeepMine}
        onTakeTheirs={handleTakeTheirs}
      />
    );
  };

  // Right-click on any part of the window that has no menu of its own. The Tasks tab has tasks to add, not notes
  const appEntries: MenuEntry[] = [
    // Nothing new while the vault cannot be opened
    ...(loadFailed
      ? []
      : [
          ...(inTasks
            ? [
                {
                  label: "New task",
                  icon: <PlusIcon size={14} />,
                  keys: "Ctrl+N",
                  onSelect: () => setAddTaskSignal((n) => n + 1),
                },
              ]
            : newItemEntries(handleNew)),
          "separator" as const,
        ]),
    {
      label: "Search…",
      icon: <SearchIcon size={14} />,
      keys: "Ctrl+K",
      onSelect: openSearch,
    },
    {
      label: "Settings…",
      icon: <GearIcon size={14} />,
      keys: "Ctrl+,",
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
      {isDraggingOver && (
        <div className="drop-overlay" aria-hidden="true">
          <span className="drop-overlay__text">
            {inTasks ? DROP_HINT_TASKS : DROP_HINT}
          </span>
          {!inTasks && (mode === "edit" || mode === "new") && (
            <span className="drop-overlay__sub">{DROP_HINT_PICTURES}</span>
          )}
        </div>
      )}
      <div className="app__body">
        <div
          className={`app__sidebar${compact ? " app__sidebar--float" : ""}${sidebarHidden ? " app__sidebar--hidden" : ""}`}
        >
          <Sidebar
            items={rows}
            getNote={getNote}
            folders={folders}
            selectedId={selectedId}
            selectedFolderId={selectedFolderId}
            unsavedItemId={
              isDirtyEdit && mode === "edit" && selectedId ? selectedId : null
            }
            loading={!scanned && !loadFailed}
            unavailable={loadFailed}
            trashedCount={trashCount}
            trashOpen={mode === "trash"}
            tab={sidebarTab}
            onTabChange={handleTab}
            tasksPanel={tasksPanel}
            updateAvailable={updateAvailable}
            vaults={vaults}
            onShowUpdate={onShowUpdate}
            editingItemId={mode === "edit" ? selectedId : null}
            onSelect={handlePick}
            onSelectFolder={handleSelectFolder}
            onNew={handleNew}
            onEditItem={handleEditItem}
            onDuplicateItem={handleDuplicate}
            onDeleteItem={handleDelete}
            onRenameItem={handleRename}
            onRevealItem={handleRevealItem}
            onRevealFolder={handleRevealFolder}
            onCopyItemPath={handleCopyItemPath}
            onCopyFolderPath={handleCopyFolderPath}
            onMoveFolder={handleMoveFolder}
            onOpenTrash={handleOpenTrash}
            onOpenSettings={onOpenSettings}
            onAddFolder={addFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveItem={moveItem}
            onReorderItems={handleReorderItems}
            onReorderFolders={reorderFolders}
            onOpenSearch={openSearch}
          />
        </div>
        <main
          className={`app__main${sidebarHidden ? " app__main--quick" : ""}`}
        >
          <div className="app__drag-strip" data-tauri-drag-region />
          <SidebarToggle hidden={sidebarHidden} onToggle={toggleSidebar} />
          <HeaderActions
            shown={sidebarHidden}
            inTasks={inTasks}
            newDisabled={loadFailed}
            onSearch={openSearch}
            onNew={startNew}
            onSettings={onOpenSettings}
          />
          {compact && (
            // biome-ignore lint/a11y/noStaticElementInteractions: clicking the backdrop is a mouse shortcut for Escape, which useEscape above already covers
            <div
              className={`app__scrim${floating ? " app__scrim--on" : ""}`}
              role="presentation"
              onClick={closeFloating}
            />
          )}
          {renderMain()}
          {vaultMissing && !loadFailed && (
            <VaultMissingBar
              name={vaults.vaults.find((v) => v.path === vaultPath)?.name ?? ""}
              onRetry={refreshVault}
              onManage={() => onOpenSettings("vaults")}
            />
          )}
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
          <DragGhost drag={taskDrag.drag} />
          {undoToast && (
            <UndoToast
              key={undoToast.key}
              message={
                <>
                  Deleted {undoToast.what}&ldquo;
                  <span className="toast__title">{undoToast.title}</span>
                  &rdquo;
                </>
              }
              onUndo={handleUndo}
              onClose={() => setUndoToast(null)}
            />
          )}
        </main>
      </div>
      {!IS_ANDROID && <WindowControls />}
      {/* The boundary stays mounted (only its content comes and goes), so the transition in openSearch can wait for the script */}
      <Suspense fallback={null}>
        {searchOpen && (
          <SearchPalette
            items={items}
            folders={folders}
            tasks={taskEntries}
            indexing={indexing}
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
      </Suspense>
    </div>
  );
}

// Memoised: App renders for the update check and the settings, which must not render the whole vault again
const MemoMainApp = memo(MainApp);

function App() {
  // Set by MainApp: save the editor, commit a task field being typed in, wait for the writes
  const flushRef = useRef<((leaving?: boolean) => Promise<boolean>) | null>(
    null,
  );
  const flushNow = useCallback(() => flushRef.current?.(), []);

  // Save a pending edit before the window goes away (close, or the updater's installer) or the open vault changes: the
  // editor, a task field being typed in, and the writes still running. A write that hangs must never make the window
  // impossible to close, so the wait is capped. Resolves false when a note or a task could not be saved (a flush that is
  // cut off by the cap or that throws counts as done: the window must close).
  const flushPendingSave = useCallback(async () => {
    let cap: ReturnType<typeof setTimeout> | undefined;
    const saved = await Promise.race([
      Promise.resolve(flushRef.current?.(true)).then(
        (ok) => ok !== false,
        (err) => {
          console.error("[flush]", err);
          return true;
        },
      ),
      new Promise<boolean>((resolve) => {
        cap = setTimeout(() => resolve(true), FLUSH_CAP_MS);
      }),
    ]);
    clearTimeout(cap);
    return saved;
  }, []);

  // Another vault opens, or the open one leaves the list: MainApp goes away with the list of notes whose write failed.
  // That is held back once while something is unsaved (the toast says so, with a Retry), and the second try goes through
  const vaultWarned = useRef(false);
  const canLeaveVault = useCallback(async () => {
    const gate = leaveGate(await flushPendingSave(), vaultWarned.current);
    vaultWarned.current = gate.warned;
    if (!gate.go)
      reportError(
        "This vault is still open: some of your changes could not be saved yet. Retry, or try again to leave them behind",
        undefined,
        () => void flushPendingSave(),
      );
    return gate.go;
  }, [flushPendingSave]);
  const vaults = useVaults(flushNow, canLeaveVault);
  const vaultPath = vaults.active;

  // The vault that was open could not be found at start and another one opened: say so, once. The toast is mounted with the rest
  // once the list is read, in the commit this runs in, and its listener is subscribed before this effect (a child's effects go first)
  const { fellBack } = vaults;
  useEffect(() => {
    if (fellBack)
      reportNotice(
        `The vault "${fellBack.wanted}" could not be opened (its folder was not found), so "${fellBack.opened}" was opened instead`,
      );
  }, [fellBack]);

  // A note or a task that could not be saved keeps the window open once, so the user sees why (the error toast, with
  // Retry) instead of losing the text; the next close request always closes it, so a failing disk never traps the window.
  // The check comes after the flush, so of two requests that overlap, one keeps it open and the other closes it.
  const keptOpen = useRef(false);
  useEffect(() => {
    const unlisten = appWindow.onCloseRequested(async (event) => {
      const gate = leaveGate(await flushPendingSave(), keptOpen.current);
      keptOpen.current = gate.warned;
      if (!gate.go) event.preventDefault();
    });
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
      // In a transition, like the palette: see openSearch
      startTransition(() => setSettings({ tab, message: message ?? null })),
    [],
  );
  const closeSettings = useCallback(() => setSettings(null), []);

  // The update dialog opens from the header pill and from Settings > About (which closes first: one dialog at a time)
  const [updateOpen, setUpdateOpen] = useState(false);
  const showUpdate = useCallback(() => {
    // One transition, so Settings stays until the update dialog has loaded
    startTransition(() => {
      setSettings(null);
      setUpdateOpen(true);
    });
  }, []);
  const closeUpdate = useCallback(() => setUpdateOpen(false), []);

  // With no vault to load (first run, or the last one was removed) the picker is the first screen: show the hidden window
  const picking = vaults.ready && vaultPath === null;
  useEffect(() => {
    if (picking) showWindow();
  }, [picking]);

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
            <MemoMainApp
              key={vaultPath}
              vaultPath={vaultPath}
              vaults={vaults}
              updateAvailable={updater.update !== null}
              onShowUpdate={showUpdate}
              flushRef={flushRef}
              onOpenSettings={openSettings}
            />
          </VaultPathContext.Provider>
          <Suspense fallback={null}>
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
                unsaved={updater.unsaved}
                onInstall={updater.install}
                onClose={closeUpdate}
              />
            )}
          </Suspense>
        </>
      )}
      <ErrorToast />
    </ContextMenuProvider>
  );
}

export default App;
