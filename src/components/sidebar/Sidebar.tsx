// src/components/sidebar/Sidebar.tsx
import {
  type ComponentProps,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useClipboard } from "../../hooks/useClipboard";
import { useDeleteConfirm } from "../../hooks/useDeleteConfirm";
import {
  type NearRow,
  TRASH_DROP_ID,
  useDragToFolder,
  useDragValue,
} from "../../hooks/useDragToFolder";
import { useStable } from "../../hooks/useLatest";
import type { Vaults } from "../../hooks/useVaults";
import { VaultPathContext } from "../../lib/attachmentStore";
import { firstCodeBlock } from "../../lib/codeBlocks";
import type { DragStore } from "../../lib/dragStore";
import { namesUnder, validateFolderName } from "../../lib/folderName";
import { folderChain } from "../../lib/folderOps";
import {
  compareFoldersManual,
  compareItemsManual,
  placeNear,
} from "../../lib/order";
import { perfRender } from "../../lib/perf";
import { IS_ANDROID } from "../../lib/platform";
import {
  isFolderCollapsed,
  readPref,
  setFolderCollapsed,
  writePref,
} from "../../lib/prefs";
import {
  groupByFolder,
  type NotesByFolder,
  type SortedRows,
  sortRows,
} from "../../lib/rowItems";
import {
  type TreeKey,
  type TreeMove,
  treeItemId,
  treeStep,
  visibleRows,
} from "../../lib/treeNav";
import { compareNames, flattenFolders, itemKind } from "../../lib/utils";
import type { Folder, Item, ItemKind } from "../../types";
import type { OpenSettings } from "../dialogs/SettingsDialog";
import Button from "../ui/Button";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import DragGhost from "../ui/DragGhost";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  ClipboardCopyIcon,
  ClipboardIcon,
  CopyIcon,
  EditIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  GearIcon,
  KindIcon,
  NoFolderIcon,
  NoteIcon,
  PlusIcon,
  SearchIcon,
  SortIcon,
  TextCursorInputIcon,
  TrashIcon,
} from "../ui/Icon";
import IconButton from "../ui/IconButton";
import InlineInput from "../ui/InlineInput";
import { NEW_KINDS, newItemEntries } from "../ui/newKinds";
import Segmented from "../ui/Segmented";
import Tooltip from "../ui/Tooltip";
import FolderRow from "./FolderRow";
import ItemRow from "./ItemRow";
import SidebarHeader from "./SidebarHeader";

/** The two halves of the app: the notes, and the to-do lists. */
export type SidebarTab = "notes" | "tasks";

const TABS: { value: SidebarTab; label: string; icon: ReactNode }[] = [
  { value: "notes", label: "Notes", icon: <NoteIcon size={13} /> },
  { value: "tasks", label: "Tasks", icon: <CircleCheckIcon size={13} /> },
];

// How the sidebar lists notes and sibling folders. "manual" follows the ranks set by dragging
// (a folder or note without one comes last, by name); folders have no date, so they go by name otherwise.
type SortBy = "manual" | "name" | "edited";

const SORT_ORDER: SortBy[] = ["manual", "name", "edited"];
const SORT_LABEL: Record<SortBy, string> = {
  manual: "Manual",
  name: "Name",
  edited: "Recent",
};
const SORT_KEY = "graphene.sort";

const COMPARE: Record<SortBy, (a: Item, b: Item) => number> = {
  manual: compareItemsManual,
  name: (a, b) => compareNames(a.title, b.title),
  edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

const byFolderName = (a: Folder, b: Folder) => compareNames(a.name, b.name);
const FOLDER_COMPARE: Record<SortBy, (a: Folder, b: Folder) => number> = {
  manual: compareFoldersManual,
  name: byFolderName,
  edited: byFolderName,
};

function readSort(): SortBy {
  const stored = readPref(SORT_KEY);
  return SORT_ORDER.find((s) => s === stored) ?? "manual";
}

interface SidebarProps {
  // The notes as the rows need them (see lib/rowItems): the same array, and the same objects, while nothing a row shows has changed,
  // so a batch of note texts does not render the sidebar. A note here may lack its text: use `getNote` for a note's own text
  items: Item[];
  /** The note as it is now, with its text (what a menu copies); `items` may be older. */
  getNote: (id: string) => Item | undefined;
  folders: Folder[];
  selectedId: string | null;
  selectedFolderId: string | null;
  unsavedItemId: string | null;
  /** The first scan has not returned yet: the list is empty because nothing is known, not because the vault is. */
  loading?: boolean;
  /** The vault cannot be opened (VaultUnavailable shows): nothing here may write into it, so New note, New code, Add folder and the tree's menu are off. */
  unavailable?: boolean;
  trashedCount: number;
  trashOpen: boolean;
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  // What the Tasks tab shows in place of the notes (the lists: see TaskLists)
  tasksPanel: ReactNode;
  updateAvailable: boolean;
  vaults: Vaults;
  // Item open in the editor: its title and folder belong to the editor until it closes
  editingItemId: string | null;
  onSelect: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  // folderId omitted = wherever the selection is; null = no folder
  onNew: (kind: ItemKind, folderId?: string | null) => void;
  onEditItem: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, title: string) => void;
  onRevealItem: (item: Item) => void;
  onRevealFolder: (folderId: string) => void;
  onCopyItemPath: (item: Item) => void;
  onCopyFolderPath: (folderId: string) => void;
  // A folder under another parent (null: the vault root)
  onMoveFolder: (id: string, parentId: string | null) => void;
  onShowUpdate: () => void;
  onOpenTrash: () => void;
  onOpenSettings: OpenSettings;
  onAddFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveItem: (itemId: string, targetFolderId: string | null) => void;
  // Puts notes in a new order: the ranks to write, and the note that was dragged with the folder it now sits in
  onReorderItems: (
    ranks: Record<string, number>,
    movedId: string,
    folderId: string | null,
  ) => void;
  onReorderFolders: (ranks: Record<string, number>) => void;
  onOpenSearch: () => void;
}

const NO_NOTES: Item[] = [];

// What each key does on the tree (see lib/treeNav); Enter and Space are handled beside them
const TREE_MOVES = new Map<string, TreeMove>([
  ["ArrowDown", "down"],
  ["ArrowUp", "up"],
  ["Home", "home"],
  ["End", "end"],
  ["ArrowRight", "right"],
  ["ArrowLeft", "left"],
]);

// The tree's own element carries the tint of the unfiled zone. It reads the drag itself, so Sidebar does not render when the pointer
// crosses into or out of that zone (its children are the same elements as before, so they do not render either)
function TreeFrame({
  drag,
  ...props
}: ComponentProps<"div"> & { drag: DragStore }) {
  const over = useDragValue(
    drag,
    (view) => view.source !== null && view.overId === null,
  );
  return (
    <div
      {...props}
      className={`sidebar__folders${over ? " sidebar__folders--drag-over" : ""}`}
    />
  );
}

interface SidebarFooterProps {
  tab: SidebarTab;
  trashOpen: boolean;
  trashedCount: number;
  /** The vault cannot be opened: there is no trash to open or to count */
  unavailable: boolean;
  drag: DragStore;
  onOpenTrash: () => void;
  onOpenSettings: OpenSettings;
}

// Trash (a wide drop target while a note is dragged) and Settings. It reads the drag itself: only a note can go to the Trash, and
// a dragged folder cannot
const SidebarFooter = memo(function SidebarFooter({
  tab,
  trashOpen,
  trashedCount,
  unavailable,
  drag,
  onOpenTrash,
  onOpenSettings,
}: SidebarFooterProps) {
  const { open } = useContextMenu();
  const noteDragging = useDragValue(
    drag,
    (view) => view.source?.kind === "item",
  );
  const overTrash = useDragValue(
    drag,
    (view) => view.source?.kind === "item" && view.overId === TRASH_DROP_ID,
  );
  return (
    <div
      className={`sidebar__footer${noteDragging ? " sidebar__footer--dragging" : ""}${tab === "tasks" ? " sidebar__footer--end" : ""}`}
    >
      {tab === "notes" && (
        <Tooltip label="Trash">
          <button
            type="button"
            className={`sidebar__trash${trashOpen ? " sidebar__trash--active" : ""}${noteDragging ? " sidebar__trash--drop" : ""}${overTrash ? " sidebar__trash--over" : ""}`}
            aria-label={
              unavailable
                ? "Trash"
                : `Trash, ${trashedCount} ${trashedCount === 1 ? "note" : "notes"}`
            }
            disabled={unavailable}
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
          >
            <TrashIcon size={16} />
            {noteDragging ? (
              <span>Drop to move to Trash</span>
            ) : (
              !unavailable &&
              trashedCount > 0 && (
                <span className="sidebar__trash-count">{trashedCount}</span>
              )
            )}
          </button>
        </Tooltip>
      )}
      <Tooltip label="Settings" keys="Ctrl+,">
        <IconButton
          size="lg"
          className="sidebar__settings"
          onClick={() => onOpenSettings()}
          aria-label="Settings"
        >
          <GearIcon size={16} />
        </IconButton>
      </Tooltip>
    </div>
  );
});

function Sidebar({
  items,
  getNote,
  folders,
  selectedId,
  selectedFolderId,
  unsavedItemId,
  loading = false,
  unavailable = false,
  trashedCount,
  trashOpen,
  tab,
  onTabChange,
  tasksPanel,
  updateAvailable,
  vaults,
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
  onCopyItemPath,
  onCopyFolderPath,
  onMoveFolder,
  onShowUpdate,
  onOpenTrash,
  onOpenSettings,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveItem,
  onReorderItems,
  onReorderFolders,
  onOpenSearch,
}: SidebarProps) {
  perfRender("Sidebar");
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>(readSort);
  const { open, openAt } = useContextMenu();
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const { copy } = useClipboard();

  // The rows are the tree, and the keys and the focus are its; the list around them scrolls, and holds the header and the box for
  // a new folder, which are not tree items
  const treeRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Each tab's list is unmounted while the other tab shows, so its scroll position is kept here and put back when the tab returns
  const asideRef = useRef<HTMLElement>(null);
  const scrolls = useRef({ notes: 0, tasks: 0 });
  useLayoutEffect(() => {
    const list =
      asideRef.current?.querySelector<HTMLElement>(".sidebar__folders");
    if (list) list.scrollTop = scrolls.current[tab];
  }, [tab]);

  // The Del key (with the tree focused) and the folder menu ask first; the banner below is the confirmation
  const folderDelete = useDeleteConfirm(
    selectedFolderId ?? "",
    () => {
      if (selectedFolderId !== null) onDeleteFolder(selectedFolderId);
    },
    selectedFolderId !== null,
    treeRef,
  );

  const { drag, startDrag } = useDragToFolder((source, target, near) => {
    if (near) {
      if (source.kind === "item") placeItem(source.id, near);
      else placeFolder(source.id, near);
    } else if (target === TRASH_DROP_ID) onDeleteItem(source.id);
    else if (target !== undefined) onMoveItem(source.id, target);
  });
  // Kept the same function, so the memoised rows are not rendered again for a new one
  const startItemDrag = useCallback(
    (e: React.PointerEvent, id: string, label: string) =>
      startDrag(e, { kind: "item", id, label }),
    [startDrag],
  );
  const startFolderDrag = useCallback(
    (e: React.PointerEvent, folder: Folder) =>
      startDrag(e, {
        kind: "folder",
        id: folder.id,
        label: folder.name,
        parent: folder.parentId ?? "",
      }),
    [startDrag],
  );

  const rootFolders = useMemo(
    () =>
      folders.filter((f) => f.parentId === null).sort(FOLDER_COMPARE[sortBy]),
    [folders, sortBy],
  );

  // No folder filter — the tree handles folder grouping visually
  // A save that cannot change the order (an edited date under Manual or Name) does not sort again (lib/rowItems `sortRows`)
  const lastSort = useRef<SortedRows | null>(null);
  const sorted = useMemo(() => {
    lastSort.current = sortRows(lastSort.current, items, COMPARE[sortBy]);
    return lastSort.current.sorted;
  }, [items, sortBy]);

  // Each folder's notes, once, in the order shown; a folder whose notes did not change keeps its array
  const lastByFolder = useRef<NotesByFolder>(new Map());
  const byFolder = useMemo(
    () => groupByFolder(sorted, lastByFolder.current),
    [sorted],
  );
  lastByFolder.current = byFolder;
  const unfiledItems = byFolder.get(null) ?? NO_NOTES;

  // A note that is newly the selected one (Ctrl+K, an Undo, a note made in a folder) opens the folders around it so it can be seen. It is
  // done in the render that picks it: the folder rows read their open state as they render. Only a new pick does, so a folder the user
  // closes afterwards stays closed
  const vault = useContext(VaultPathContext) ?? "";
  const revealed = useRef(selectedId);
  if (revealed.current !== selectedId) {
    revealed.current = selectedId;
    const at = items.find((i) => i.id === selectedId)?.folderId ?? null;
    for (const id of folderChain(at))
      if (isFolderCollapsed(vault, id))
        setFolderCollapsed(vault, id, false, false); // silent: this is a render, the rows read it as they render
  }
  // ...and the list scrolls to it when it is out of view. One already in view stays put, and so does the list on a return from the
  // other tab (the selection did not change then). Only the list moves: scrollIntoView would also scroll a floating sidebar that is
  // slid out of the window
  useEffect(() => {
    const list = listRef.current;
    const row =
      selectedId &&
      list?.querySelector<HTMLElement>(
        `[data-item-id="${CSS.escape(selectedId)}"]`,
      );
    if (!list || !row) return;
    const r = row.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    if (r.top < l.top) list.scrollTop += r.top - l.top;
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
  }, [selectedId]);

  const countLabel = loading
    ? "Loading…"
    : `${sorted.length} ${sorted.length === 1 ? "note" : "notes"}`;

  const chooseSort = (next: SortBy) => {
    setSortBy(next);
    writePref(SORT_KEY, next);
  };

  const openSortMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    openAt(
      r.left,
      r.bottom + 2,
      SORT_ORDER.map((s) => ({
        label: SORT_LABEL[s],
        checked: s === sortBy,
        onSelect: () => chooseSort(s),
      })),
    );
  };

  // A note or folder dropped next to another: ranks for it and for the siblings that need one (see lib/order).
  // From Name or Recent they number the list as it is shown, so nothing jumps, and the order becomes Manual.
  const placeItem = (movedId: string, near: NearRow) => {
    const anchor = items.find((i) => i.id === near.id);
    if (!anchor) return;
    const siblings = items
      .filter((i) => i.folderId === anchor.folderId)
      .sort(COMPARE[sortBy]);
    const ranks = placeNear(
      siblings,
      movedId,
      near.id,
      near.after,
      sortBy !== "manual",
    );
    if (Object.keys(ranks).length === 0) return;
    onReorderItems(ranks, movedId, anchor.folderId);
    chooseSort("manual");
  };

  const placeFolder = (movedId: string, near: NearRow) => {
    const anchor = folders.find((f) => f.id === near.id);
    if (!anchor) return;
    const siblings = folders
      .filter((f) => f.parentId === anchor.parentId)
      .sort(FOLDER_COMPARE[sortBy]);
    const ranks = placeNear(
      siblings,
      movedId,
      near.id,
      near.after,
      sortBy !== "manual",
    );
    if (Object.keys(ranks).length === 0) return;
    onReorderFolders(ranks);
    chooseSort("manual");
  };

  // Move up and Move down, for whoever cannot drag: one place over among the siblings, in the order shown. From
  // Name or Recent it numbers the list as shown and the order becomes Manual, as a drop does.
  const moveFolder = useStable((id: string, delta: 1 | -1) => {
    const parentId = folders.find((f) => f.id === id)?.parentId;
    const siblings = folders
      .filter((f) => f.parentId === parentId)
      .sort(FOLDER_COMPARE[sortBy]);
    const near = siblings[siblings.findIndex((f) => f.id === id) + delta];
    if (near) placeFolder(id, { id: near.id, after: delta > 0 });
  });

  // The row the tree is on: the highlighted folder, else the open note (a folder can be highlighted while a note stays open)
  const activeRow: TreeKey | null = selectedFolderId
    ? { kind: "folder", id: selectedFolderId }
    : selectedId
      ? { kind: "item", id: selectedId }
      : null;

  // A key on the tree: where it goes is lib/treeNav's. A note is opened (the selection follows the keys, as it always did), a
  // folder is only highlighted, or opened or closed
  const moveInTree = (move: TreeMove) => {
    const rows = visibleRows(folders, byFolder, FOLDER_COMPARE[sortBy], (id) =>
      isFolderCollapsed(vault, id),
    );
    const step = treeStep(rows, activeRow, move);
    if (!step) return;
    if (step.do === "focus") {
      if (step.row.kind === "folder") onSelectFolder(step.row.id);
      else onSelect(step.row.id);
      document
        .getElementById(treeItemId(step.row))
        ?.scrollIntoView({ block: "nearest" });
    } else setFolderCollapsed(vault, step.id, step.do === "collapse");
  };

  const handleTreeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ignore keys typed into the folder name inputs that live inside the tree
    if (e.target !== e.currentTarget) return;
    const plain = !(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey);
    const move = plain ? TREE_MOVES.get(e.key) : undefined;
    if (move) {
      e.preventDefault();
      moveInTree(move);
    } else if (plain && (e.key === "Enter" || e.key === " ")) {
      // Opens the note, or opens or closes the folder: what a click on the row does
      if (!activeRow) return;
      e.preventDefault();
      if (activeRow.kind === "item") onSelect(activeRow.id);
      else
        setFolderCollapsed(
          vault,
          activeRow.id,
          !isFolderCollapsed(vault, activeRow.id),
        );
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
        // The header's own F2 (rename the open note) must not fire as well. A highlighted folder is the one to
        // rename, else the selected note; with neither in view the header's F2 still renames the open note
        if (selectedFolderId) {
          e.stopPropagation();
          const folderRow = treeRef.current?.querySelector(
            `[data-sort-kind="folder"][data-sort-id="${CSS.escape(selectedFolderId)}"]`,
          );
          if (folderRow) setRenamingFolderId(selectedFolderId);
        } else if (row && item) {
          e.stopPropagation();
          setRenamingItemId(item.id);
        }
        return;
      }
      // A highlighted folder has its own menu (Move up, Move to, Delete ...): it is asked for as a right-click on its row
      const folderRow = selectedFolderId
        ? document.getElementById(
            treeItemId({ kind: "folder", id: selectedFolderId }),
          )
        : null;
      if (folderRow) {
        const r = folderRow.getBoundingClientRect();
        folderRow.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: r.left + 24,
            clientY: r.bottom,
          }),
        );
        return;
      }
      // Anchored on the selected row, or on the tree when nothing visible is selected
      const rect = (row ?? treeRef.current)?.getBoundingClientRect();
      if (rect && !unavailable)
        openAt(
          rect.left + 24,
          rect.bottom,
          row && item ? itemEntries(item) : treeEntries(),
        );
    }
  };

  // Clicking an item parks focus on the tree so the arrow keys keep working from there
  // The functions the memoised rows are given stay the same ones (useStable) and run what the newest render says
  const selectItem = useStable((id: string) => {
    onSelect(id);
    // No ring: after a key press elsewhere (a draft's textarea) the browser would show one round the whole tree
    treeRef.current?.focus({ preventScroll: true, focusVisible: false });
  });

  // A click on a folder parks the focus on the tree too, so the keys (the arrows, Right and Left) work from there at once
  const selectFolder = useStable((id: string | null) => {
    onSelectFolder(id);
    treeRef.current?.focus({ preventScroll: true, focusVisible: false });
  });

  const handleAddSubfolder = useStable((parentId: string, name: string) =>
    onAddFolder(name, parentId),
  );

  // The folder menu goes through the same confirmation banner as the Del key
  const requestDeleteFolder = useStable((id: string) => {
    onSelectFolder(id); // the banner only renders for the selected folder
    folderDelete.arm(id);
  });
  const confirmDeleteFolder = useStable(() => folderDelete.requestDelete());
  const cancelDeleteFolder = useStable(() => folderDelete.cancelConfirm());

  const treeEntries = (): MenuEntry[] => [
    // No folder: Ctrl+N starts the note wherever the selection is, so the entries carry no shortcut
    ...newItemEntries((kind) => onNew(kind, null), "", false),
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
      to(null, "No folder", <NoFolderIcon size={14} />),
      ...flattenFolders(folders, FOLDER_COMPARE[sortBy]).map(
        ({ folder, depth }) =>
          to(folder.id, folder.name, <FolderIcon size={14} />, depth),
      ),
    ];
  };

  const itemEntries = (row: Item): MenuEntry[] => {
    // The rows may be older than the note in what they do not show: the text and whether it is read yet
    const item = getNote(row.id) ?? row;
    const kind = itemKind(item);
    const siblings = sorted.filter((i) => i.folderId === item.folderId);
    const at = siblings.findIndex((i) => i.id === item.id);
    return [
      {
        label: "Open",
        icon: <KindIcon kind={kind} size={14} />,
        onSelect: () => selectItem(item.id),
      },
      {
        label: "Edit",
        icon: <EditIcon size={14} />,
        keys: "Ctrl+E",
        onSelect: () => onEditItem(item.id),
      },
      {
        label: "Rename",
        icon: <TextCursorInputIcon size={14} />,
        keys: "F2",
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
        // Its text may not be read yet (the start of a big vault): there is nothing to copy until it is
        disabled: !!item.unloaded,
        onSelect: () => copy(item.body),
      },
      ...(kind === "code"
        ? [
            {
              label: "Copy code",
              icon: <ClipboardCopyIcon size={14} />,
              disabled: !!item.unloaded,
              onSelect: () => copy(firstCodeBlock(item.body)),
            },
          ]
        : []),
      "separator",
      {
        label: "Move up",
        icon: <ChevronUpIcon size={14} />,
        disabled: at <= 0,
        onSelect: () =>
          placeItem(item.id, { id: siblings[at - 1].id, after: false }),
      },
      {
        label: "Move down",
        icon: <ChevronDownIcon size={14} />,
        disabled: at === -1 || at === siblings.length - 1,
        onSelect: () =>
          placeItem(item.id, { id: siblings[at + 1].id, after: true }),
      },
      {
        label: "Move to",
        icon: <FolderInputIcon size={14} />,
        submenu: moveEntries(item),
      },
      // Android keeps its notes in the app's own storage, which no file manager shows
      ...(IS_ANDROID
        ? []
        : [
            {
              label: "Show in Explorer",
              icon: <ExternalLinkIcon size={14} />,
              onSelect: () => onRevealItem(item),
            },
            {
              label: "Copy path",
              icon: <ClipboardIcon size={14} />,
              onSelect: () => onCopyItemPath(item),
            },
          ]),
      "separator",
      {
        label: "Move to trash",
        icon: <TrashIcon size={14} />,
        keys: "Del",
        danger: true,
        onSelect: () => onDeleteItem(item.id),
      },
    ];
  };

  // The row gives its id: the note comes from the newest list
  const handleItemContextMenu = useStable((e: React.MouseEvent, id: string) => {
    const item = getNote(id);
    if (item) open(e, itemEntries(item)); // stops the event: the tree behind has its own menu
  });

  // The "…" button of a note row: the same menu, under the button
  const openItemMenuAt = useStable((id: string, x: number, y: number) => {
    const item = getNote(id);
    if (!item) return;
    // The menu hands the focus back to what had it: the tree, not the button, so the keys go on working
    treeRef.current?.focus({ preventScroll: true, focusVisible: false });
    openAt(x, y, itemEntries(item));
  });

  const handleItemRenameEnd = useStable((id: string, title: string | null) => {
    setRenamingItemId(null);
    const current = items.find((i) => i.id === id);
    if (title !== null && current && title !== current.title)
      onRenameItem(id, title);
    // Enter/Escape leave focus on the removed input; a blur (click elsewhere) must keep its new target
    if (document.activeElement instanceof HTMLInputElement)
      treeRef.current?.focus({ preventScroll: true });
  });

  // A folder's rename field (FolderRow) opens and closes through here, so F2 can start it
  const handleFolderRenaming = useStable((id: string | null) => {
    setRenamingFolderId(id);
    // Enter and Escape leave the focus on the removed input (see above): the tree takes it back
    if (id === null && document.activeElement instanceof HTMLInputElement)
      treeRef.current?.focus({ preventScroll: true });
  });

  return (
    <aside
      ref={asideRef}
      className="sidebar"
      onScrollCapture={(e) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.classList.contains("sidebar__folders")
        )
          scrolls.current[tab] = e.target.scrollTop;
      }}
    >
      <SidebarHeader
        updateAvailable={updateAvailable}
        vaults={vaults}
        onShowUpdate={onShowUpdate}
        onOpenSettings={onOpenSettings}
      />

      <Segmented
        label="Sidebar"
        className="sidebar__tabs"
        value={tab}
        options={TABS}
        onChange={onTabChange}
      />

      {tab === "tasks" ? (
        unavailable ? (
          // The lists and their "+" buttons would write into the vault: not while it cannot be opened
          <div className="sidebar__empty">
            Tasks are not available while the vault cannot be opened
          </div>
        ) : (
          tasksPanel
        )
      ) : (
        <>
          {/* Search first, as in the Tasks tab; then new note, new code */}
          <nav className="sidebar__nav">
            <button
              type="button"
              className="sidebar__nav-item"
              onClick={onOpenSearch}
            >
              <SearchIcon size={16} />
              <span>Search</span>
              <span className="sidebar__nav-count sidebar__nav-count--keys">
                Ctrl+K
              </span>
            </button>
            {NEW_KINDS.map(({ kind, label, Icon, shortcut }) => (
              <Tooltip key={kind} label={`New ${label}`} keys={shortcut}>
                <button
                  type="button"
                  className="sidebar__nav-item"
                  disabled={unavailable}
                  onClick={() => onNew(kind)}
                >
                  <Icon size={16} />
                  <span>New {label}</span>
                </button>
              </Tooltip>
            ))}
          </nav>

          {/* Folder + tree section */}
          {unavailable ? (
            // Nothing can be listed, counted or written while the vault cannot be opened: say so, not "0 notes" and "Nothing here yet"
            <div className="sidebar__folders">
              <div className="sidebar__empty">
                Notes are not available while the vault cannot be opened
              </div>
            </div>
          ) : (
            <TreeFrame
              drag={drag}
              ref={listRef}
              data-folder-drop-id="unfiled"
              data-scrollbar
              onContextMenu={(e) => open(e, treeEntries())}
              onClick={(e) => {
                // Empty space deselects the folder
                if (
                  e.target === e.currentTarget ||
                  e.target === treeRef.current
                )
                  onSelectFolder(null);
              }}
            >
              <div className="sidebar__folders-header">
                <span className="sidebar__folders-label">{countLabel}</span>
                <div className="sidebar__folders-tools">
                  <Tooltip label={`Order: ${SORT_LABEL[sortBy]}`}>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={openSortMenu}
                      aria-haspopup="menu"
                    >
                      <SortIcon size={11} />
                      {SORT_LABEL[sortBy]}
                    </Button>
                  </Tooltip>
                  <Tooltip label="New folder">
                    <IconButton
                      size="sm"
                      onClick={() => setShowAddFolder((v) => !v)}
                      aria-label="New folder at the top level"
                    >
                      <PlusIcon size={13} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>

              {showAddFolder && (
                <div className="sidebar__folder-add-row">
                  <InlineInput
                    className="sidebar__folder-add-input"
                    placeholder="Folder name…"
                    validate={(name) =>
                      validateFolderName(name, namesUnder(folders, null))
                    }
                    onCommit={(name) => {
                      onAddFolder(name, null);
                      setShowAddFolder(false);
                    }}
                    onCancel={() => setShowAddFolder(false)}
                  />
                </div>
              )}

              <div
                ref={treeRef}
                className="sidebar__tree"
                role="tree"
                aria-label="Notes"
                aria-activedescendant={
                  activeRow ? treeItemId(activeRow) : undefined
                }
                // a tree is a composite widget: it is the single tab stop, takes the arrow keys, and keeps the focus while a row is active
                tabIndex={0}
                onKeyDown={handleTreeKeyDown}
              >
                {rootFolders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    allFolders={folders}
                    byFolder={byFolder}
                    selectedFolderId={selectedFolderId}
                    selectedId={selectedId}
                    unsavedItemId={unsavedItemId}
                    drag={drag}
                    renamingItemId={renamingItemId}
                    renamingFolderId={renamingFolderId}
                    onRenamingFolder={handleFolderRenaming}
                    onSelect={selectFolder}
                    onSelectItem={selectItem}
                    compareFolders={FOLDER_COMPARE[sortBy]}
                    onMove={moveFolder}
                    onItemPointerDown={startItemDrag}
                    onFolderPointerDown={startFolderDrag}
                    onAddSubfolder={handleAddSubfolder}
                    onRename={onRenameFolder}
                    onDelete={requestDeleteFolder}
                    deleteConfirmId={
                      folderDelete.confirming ? selectedFolderId : null
                    }
                    onConfirmDelete={confirmDeleteFolder}
                    onCancelDelete={cancelDeleteFolder}
                    onNew={onNew}
                    onReveal={onRevealFolder}
                    onCopyPath={onCopyFolderPath}
                    onMoveTo={onMoveFolder}
                    onOpenMenu={openAt}
                    onItemContextMenu={handleItemContextMenu}
                    onItemRenameEnd={handleItemRenameEnd}
                    onItemMore={openItemMenuAt}
                  />
                ))}

                {/* Unfiled items — no folder assigned */}
                {unfiledItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    kind={itemKind(item)}
                    isSelected={selectedId === item.id}
                    isUnsaved={unsavedItemId === item.id}
                    isRenaming={renamingItemId === item.id}
                    level={1}
                    onSelect={selectItem}
                    onPointerDown={startItemDrag}
                    onContextMenu={handleItemContextMenu}
                    onRenameEnd={handleItemRenameEnd}
                    onMore={openItemMenuAt}
                  />
                ))}
              </div>

              {sorted.length === 0 && !loading && (
                <div className="sidebar__empty">Nothing here yet</div>
              )}
            </TreeFrame>
          )}
        </>
      )}

      <SidebarFooter
        tab={tab}
        trashOpen={trashOpen}
        trashedCount={trashedCount}
        unavailable={unavailable}
        drag={drag}
        onOpenTrash={onOpenTrash}
        onOpenSettings={onOpenSettings}
      />

      {/* Drag ghost — follows cursor while dragging */}
      <DragGhost drag={drag} />
    </aside>
  );
}

export default memo(Sidebar);
