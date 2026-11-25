// src/components/sidebar/listMenu.tsx
// The menu of a to-do list, shared by its row in the sidebar (right-click and "…") and the "…" in the heading of the Tasks pane, so
// both offer the same entries and a delete asks and undoes the same way.
import type { TasksApi } from "../../hooks/useTasks";
import { placeNear } from "../../lib/order";
import {
  COLOR_KEYS,
  type ColorKey,
  DEFAULT_LIST_ID,
  openCount,
  sortedGroups,
  sortedLists,
  type Task,
  type TaskList,
} from "../../lib/taskStore";
import type { MenuEntry } from "../ui/ContextMenu";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FolderIcon,
  FolderInputIcon,
  NoFolderIcon,
  TextCursorInputIcon,
  TrashIcon,
} from "../ui/Icon";

const COLOR_LABEL: Record<ColorKey, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
};

export function ColorDot({ color }: { color?: ColorKey }) {
  return <span className="task-dot" data-color={color} aria-hidden="true" />;
}

/** Move up and Move down, for whoever cannot drag: one place over among the siblings, in the order shown. */
export function shiftEntries(
  siblings: { id: string; order?: number }[],
  id: string,
  write: (ranks: Record<string, number>) => void,
): MenuEntry[] {
  const at = siblings.findIndex((s) => s.id === id);
  const shift = (delta: 1 | -1) => {
    const near = siblings[at + delta];
    if (near) write(placeNear(siblings, id, near.id, delta > 0));
  };
  return [
    {
      label: "Move up",
      icon: <ChevronUpIcon size={14} />,
      disabled: at <= 0,
      onSelect: () => shift(-1),
    },
    {
      label: "Move down",
      icon: <ChevronDownIcon size={14} />,
      disabled: at === -1 || at === siblings.length - 1,
      onSelect: () => shift(1),
    },
  ];
}

/** Rename, Colour, Move up and down, Move to group and Delete list. `rename` and `remove` start the field and the question, which live with the caller. */
export function listEntries(
  api: TasksApi,
  list: TaskList,
  actions: { rename: () => void; remove: () => void },
): MenuEntry[] {
  const groups = sortedGroups(api.index);
  return [
    {
      label: "Rename",
      icon: <TextCursorInputIcon size={14} />,
      onSelect: actions.rename,
    },
    {
      label: "Color",
      icon: <ColorDot color={list.color} />,
      submenu: [
        {
          label: "No color",
          checked: !list.color,
          onSelect: () => api.updateList(list.id, { color: null }),
        },
        ...COLOR_KEYS.map((key) => ({
          label: COLOR_LABEL[key],
          icon: <ColorDot color={key} />,
          checked: list.color === key,
          onSelect: () => api.updateList(list.id, { color: key }),
        })),
      ],
    },
    ...shiftEntries(
      sortedLists(api.index, list.groupId ?? null),
      list.id,
      api.rankLists,
    ),
    ...(groups.length > 0 || list.groupId
      ? [
          {
            label: "Move to group",
            icon: <FolderInputIcon size={14} />,
            submenu: [
              {
                label: "No group",
                icon: <NoFolderIcon size={14} />,
                checked: !list.groupId,
                onSelect: () => api.updateList(list.id, { groupId: null }),
              },
              ...groups.map((g) => ({
                label: g.name,
                icon: <FolderIcon size={14} />,
                checked: list.groupId === g.id,
                onSelect: () => api.updateList(list.id, { groupId: g.id }),
              })),
            ],
          } satisfies MenuEntry,
        ]
      : []),
    ...(list.id === DEFAULT_LIST_ID
      ? []
      : [
          "separator" as const,
          {
            label: "Delete list",
            icon: <TrashIcon size={14} />,
            danger: true,
            onSelect: actions.remove,
          },
        ]),
  ];
}

/** What the question under a list says before it is deleted: every task in it goes, the ticked ones too. */
export function deleteListQuestion(list: TaskList, tasks: Task[]): string {
  const total = tasks.length;
  return `Delete “${list.name}”${
    total > 0
      ? ` and its ${total} ${total === 1 ? "task" : "tasks"} (${openCount(tasks)} open)?`
      : "?"
  }`;
}

/**
 * Deletes the list, shows the default one if it was the open view, and hands the Undo to `onDeleted`
 * (`what` is the word before the name, "the list ").
 */
export function deleteListWithUndo(
  api: TasksApi,
  list: TaskList,
  openView: string,
  onSelect: (view: string) => void,
  onDeleted: (what: string, title: string, undo: () => void) => void,
): void {
  const gone = api.deleteList(list.id);
  const wasOpen = openView === list.id;
  if (wasOpen) onSelect(DEFAULT_LIST_ID);
  if (gone)
    onDeleted("the list ", list.name, () => {
      api.restoreList(gone);
      if (wasOpen) onSelect(list.id);
    });
}
