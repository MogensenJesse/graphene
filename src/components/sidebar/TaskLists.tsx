// src/components/sidebar/TaskLists.tsx
import { useContext, useState } from "react";
import { useEscape } from "../../hooks/useEscape";
import type { TasksApi } from "../../hooks/useTasks";
import { VaultPathContext } from "../../lib/attachmentStore";
import { isFolderCollapsed, setFolderCollapsed } from "../../lib/prefs";
import {
  COLOR_KEYS,
  type ColorKey,
  DEFAULT_LIST_ID,
  openCount,
  orderedLists,
  smartList,
  sortedGroups,
  sortedLists,
  type TaskGroup,
  type TaskList,
} from "../../lib/taskStore";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import {
  ChevronRightIcon,
  EllipsisIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  NoFolderIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  SunIcon,
  TextCursorInputIcon,
  TrashIcon,
} from "../ui/Icon";
import InlineInput from "../ui/InlineInput";
import Tooltip from "../ui/Tooltip";

const COLOR_LABEL: Record<ColorKey, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
};

const groupKey = (id: string) => `group:${id}`;

function ColorDot({ color }: { color?: ColorKey }) {
  return <span className="task-dot" data-color={color} aria-hidden="true" />;
}

interface TaskListsProps {
  api: TasksApi;
  /** "my-day", "important", or a list id */
  selected: string;
  onSelect: (view: string) => void;
  onOpenSearch: () => void;
  /** A press on a list or group row that may start a drag (see useDragToFolder). */
  onListPointerDown?: (e: React.PointerEvent, list: TaskList) => void;
  onGroupPointerDown?: (e: React.PointerEvent, group: TaskGroup) => void;
  /** Which row a drag is over: undefined = none, null = the area outside every group, else a list or group id. */
  dragOverId?: string | null;
}

/** The Tasks tab of the sidebar: My Day and Important, then the lists, some of them in groups. */
function TaskLists({
  api,
  selected,
  onSelect,
  onOpenSearch,
  onListPointerDown,
  onGroupPointerDown,
  dragOverId,
}: TaskListsProps) {
  const { index, tasks, today } = api;
  const { open, openAt } = useContextMenu();
  const vault = useContext(VaultPathContext) ?? "";
  // The box for a new list or group (a list can be made inside a group), what is being renamed, what waits for a yes
  const [adding, setAdding] = useState<{
    kind: "list" | "group";
    groupId?: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  // Re-rendered after a group is opened or closed; the state itself is in prefs
  const [, setTick] = useState(0);
  useEscape(() => setConfirming(null), { active: confirming !== null });

  const all = orderedLists(index);
  const countOf = (l: TaskList) => openCount(tasks[l.id] ?? []);
  const smartCount = (key: "my-day" | "important") =>
    openCount(smartList(key, all, tasks, today).map((p) => p.task));
  const groups = sortedGroups(index);
  const ungrouped = sortedLists(index, null);

  const finishAdd = (name: string) => {
    if (adding?.kind === "group") api.addGroup(name);
    else {
      const id = api.addList(name, adding?.groupId);
      if (id) onSelect(id);
    }
    if (adding?.groupId)
      setFolderCollapsed(vault, groupKey(adding.groupId), false);
    setAdding(null);
  };

  const listEntries = (list: TaskList): MenuEntry[] => [
    {
      label: "Rename",
      icon: <TextCursorInputIcon size={14} />,
      onSelect: () => setRenaming(list.id),
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
            onSelect: () => setConfirming(list.id),
          },
        ]),
  ];

  const groupEntries = (group: TaskGroup): MenuEntry[] => [
    {
      label: "New list here",
      icon: <PlusIcon size={14} />,
      onSelect: () => setAdding({ kind: "list", groupId: group.id }),
    },
    {
      label: "Rename",
      icon: <TextCursorInputIcon size={14} />,
      onSelect: () => setRenaming(group.id),
    },
    "separator",
    {
      label: "Delete group",
      icon: <TrashIcon size={14} />,
      danger: true,
      onSelect: () => api.deleteGroup(group.id),
    },
  ];

  const emptyEntries = (): MenuEntry[] => [
    {
      label: "New list",
      icon: <PlusIcon size={14} />,
      onSelect: () => setAdding({ kind: "list" }),
    },
    {
      label: "New group",
      icon: <FolderPlusIcon size={14} />,
      onSelect: () => setAdding({ kind: "group" }),
    },
  ];

  const addRow = (kind: "list" | "group") => (
    <div className="sidebar__folder-add-row">
      <InlineInput
        className="sidebar__folder-add-input"
        placeholder={kind === "list" ? "List name…" : "Group name…"}
        onCommit={finishAdd}
        onCancel={() => setAdding(null)}
      />
    </div>
  );

  const listRow = (list: TaskList) => {
    const count = countOf(list);
    const isSelected = selected === list.id;
    return (
      <div
        key={list.id}
        className="task-list-row__group"
        data-folder-drop-id={list.id}
        data-sort-kind="taskList"
        data-sort-id={list.id}
        data-sort-parent={list.groupId ?? ""}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; the "…" button has the same menu */}
        <div
          className={`task-list-row${isSelected ? " task-list-row--selected" : ""}${dragOverId === list.id ? " task-list-row--drag-over" : ""}`}
          onContextMenu={(e) => {
            if (renaming === list.id) return; // keep the input's own copy/paste menu
            open(e, listEntries(list));
          }}
        >
          {renaming === list.id ? (
            <InlineInput
              initial={list.name}
              className="folder-row__rename-input"
              ariaLabel="List name"
              onCommit={(name) => {
                if (name !== list.name) api.updateList(list.id, { name });
                setRenaming(null);
              }}
              onCancel={() => setRenaming(null)}
            />
          ) : (
            <button
              type="button"
              className="task-list-row__name"
              aria-current={isSelected ? "true" : undefined}
              onPointerDown={(e) => onListPointerDown?.(e, list)}
              onClick={() => onSelect(list.id)}
            >
              <ColorDot color={list.color} />
              <span className="task-list-row__label">{list.name}</span>
              {count > 0 && (
                <span className="task-list-row__count">{count}</span>
              )}
            </button>
          )}
          <div className="folder-row__actions">
            <Tooltip label="List options">
              <button
                type="button"
                className="folder-row__action-btn"
                aria-label={`Options for ${list.name}`}
                aria-haspopup="menu"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  openAt(r.left, r.bottom + 2, listEntries(list));
                }}
              >
                <EllipsisIcon size={13} />
              </button>
            </Tooltip>
          </div>
        </div>
        {confirming === list.id && (
          <div className="sidebar__folder-confirm-delete">
            <span>
              Delete &ldquo;{list.name}&rdquo;
              {count > 0
                ? ` and its ${count} open ${count === 1 ? "task" : "tasks"}?`
                : "?"}
            </span>
            <div className="sidebar__folder-confirm-actions">
              <button
                type="button"
                className="sidebar__folder-confirm-btn sidebar__folder-confirm-btn--danger"
                onClick={() => {
                  setConfirming(null);
                  api.deleteList(list.id);
                  if (selected === list.id) onSelect(DEFAULT_LIST_ID);
                }}
              >
                Delete
              </button>
              <button
                type="button"
                className="sidebar__folder-confirm-btn"
                onClick={() => setConfirming(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const groupRow = (group: TaskGroup) => {
    const own = sortedLists(index, group.id);
    const expanded = !isFolderCollapsed(vault, groupKey(group.id));
    const adding_here = adding?.kind === "list" && adding.groupId === group.id;
    return (
      <div
        key={group.id}
        className="folder-row__group"
        data-folder-drop-id={group.id}
        data-sort-kind="taskGroup"
        data-sort-id={group.id}
        data-sort-parent=""
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; the "…" button has the same menu */}
        <div
          className={`folder-row${dragOverId === group.id ? " folder-row--drag-over" : ""}`}
          onContextMenu={(e) => {
            if (renaming === group.id) return;
            open(e, groupEntries(group));
          }}
        >
          {renaming === group.id ? (
            <InlineInput
              initial={group.name}
              className="folder-row__rename-input"
              ariaLabel="Group name"
              onCommit={(name) => {
                if (name !== group.name) api.renameGroup(group.id, name);
                setRenaming(null);
              }}
              onCancel={() => setRenaming(null)}
            />
          ) : (
            <button
              type="button"
              className="folder-row__name"
              aria-expanded={expanded}
              onPointerDown={(e) => onGroupPointerDown?.(e, group)}
              onClick={() => {
                setFolderCollapsed(vault, groupKey(group.id), expanded);
                setTick((n) => n + 1);
              }}
            >
              <span className="folder-row__label">{group.name}</span>
              <span
                className={`folder-row__chevron chevron-turn${expanded ? " chevron-turn--open" : ""}`}
                aria-hidden="true"
              >
                <ChevronRightIcon size={12} />
              </span>
            </button>
          )}
          <div className="folder-row__actions">
            <Tooltip label="New list here">
              <button
                type="button"
                className="folder-row__action-btn"
                aria-label={`New list in ${group.name}`}
                onClick={() => setAdding({ kind: "list", groupId: group.id })}
              >
                <PlusIcon size={13} />
              </button>
            </Tooltip>
            <Tooltip label="Group options">
              <button
                type="button"
                className="folder-row__action-btn"
                aria-label={`Options for ${group.name}`}
                aria-haspopup="menu"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  openAt(r.left, r.bottom + 2, groupEntries(group));
                }}
              >
                <EllipsisIcon size={13} />
              </button>
            </Tooltip>
          </div>
        </div>
        {((expanded && own.length > 0) || adding_here) && (
          <div className="folder-row__children">
            {adding_here && addRow("list")}
            {expanded && own.map(listRow)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <nav className="sidebar__nav">
        <button
          type="button"
          className="sidebar__nav-item"
          onClick={onOpenSearch}
        >
          <SearchIcon size={16} />
          <span>Search</span>
          <span className="sidebar__nav-count">Ctrl+K</span>
        </button>
        {(["my-day", "important"] as const).map((key) => {
          const count = smartCount(key);
          return (
            <button
              key={key}
              type="button"
              className={`sidebar__nav-item${selected === key ? " sidebar__nav-item--active" : ""}`}
              aria-current={selected === key ? "true" : undefined}
              onClick={() => onSelect(key)}
            >
              {key === "my-day" ? (
                <SunIcon size={16} />
              ) : (
                <StarIcon size={16} />
              )}
              <span>{key === "my-day" ? "My Day" : "Important"}</span>
              {count > 0 && <span className="sidebar__nav-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; the buttons in the header do the same */}
      <div
        className={`sidebar__folders${dragOverId === null ? " sidebar__folders--drag-over" : ""}`}
        data-folder-drop-id="unfiled"
        onContextMenu={(e) => open(e, emptyEntries())}
      >
        <div className="sidebar__folders-header">
          <span className="sidebar__folders-label">Lists</span>
          <div className="sidebar__folders-tools">
            <Tooltip label="New group">
              <button
                type="button"
                className="sidebar__icon-btn"
                aria-label="New group"
                onClick={() => setAdding({ kind: "group" })}
              >
                <FolderPlusIcon size={13} />
              </button>
            </Tooltip>
            <Tooltip label="New list">
              <button
                type="button"
                className="sidebar__icon-btn"
                aria-label="New list"
                onClick={() => setAdding({ kind: "list" })}
              >
                <PlusIcon size={13} />
              </button>
            </Tooltip>
          </div>
        </div>

        {adding?.kind === "group" && addRow("group")}
        {groups.map(groupRow)}
        {adding?.kind === "list" && !adding.groupId && addRow("list")}
        {ungrouped.map(listRow)}
      </div>
    </>
  );
}

export default TaskLists;
