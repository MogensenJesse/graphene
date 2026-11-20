// src/components/tasks/TasksPane.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useClipboard } from "../../hooks/useClipboard";
import { useEscape } from "../../hooks/useEscape";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import type { TasksApi } from "../../hooks/useTasks";
import { longDay, nextDay } from "../../lib/taskDates";
import {
  compareTasks,
  DEFAULT_LIST_ID,
  orderedLists,
  type Placed,
  type SmartList,
  smartList,
  type Task,
} from "../../lib/taskStore";
import { isTextField } from "../../lib/textMenu";
import type { MenuEntry } from "../ui/ContextMenu";
import { useContextMenu } from "../ui/ContextMenuProvider";
import {
  CalendarIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CopyIcon,
  FolderInputIcon,
  StarIcon,
  SunIcon,
  TrashIcon,
} from "../ui/Icon";
import InlineInput from "../ui/InlineInput";
import AddTask from "./AddTask";
import TaskDetail from "./TaskDetail";
import TaskRow from "./TaskRow";

interface TasksPaneProps {
  /** "my-day", "important", or a list id */
  view: string;
  api: TasksApi;
  openTaskId: string | null;
  onOpenTask: (id: string | null) => void;
  /** A task was deleted here: the app offers the Undo. */
  onTaskDeleted: (listId: string, task: Task) => void;
  /** Goes up when the "Add a task" box should take the focus. */
  addSignal: number;
  /** Starts a drag of a task row (see useDragToFolder). */
  onTaskPointerDown?: (e: React.PointerEvent, task: Task) => void;
}

const SMART_TITLE: Record<SmartList, string> = {
  "my-day": "My Day",
  important: "Important",
};

// How long a task that left the list takes to fold away: --anim-out in _motion.scss
const ROW_LEAVE_MS = 200;

/** A task that just left the open list, kept on screen for a moment at the place it had. */
interface Leaving {
  view: string;
  at: number;
  placed: Placed;
}

const EMPTY_TEXT: Record<string, string> = {
  "my-day":
    "Nothing planned for today. Open a task and choose “Add to My Day”.",
  important: "No important tasks. Mark one with the star.",
  list: "No tasks yet. Add the first one above.",
};

/** The main pane of the Tasks tab: a heading, the box to add a task, the open tasks and the finished ones. */
function TasksPane({
  view,
  api,
  openTaskId,
  onOpenTask,
  onTaskDeleted,
  addSignal,
  onTaskPointerDown,
}: TasksPaneProps) {
  const { index, tasks, today } = api;
  const [showDone, setShowDone] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // The task was opened from the keyboard: the pane takes the focus (a mouse click leaves it where it was)
  const [focusDetail, setFocusDetail] = useState(false);
  const { open: openMenu } = useContextMenu();
  const { copy } = useClipboard();
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  // A task you just added eases in; a task that left the open list (done, deleted, moved) folds away before it goes
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  const prevRows = useRef<{ view: string; rows: Placed[] }>({
    view,
    rows: [],
  });

  const smart = view === "my-day" || view === "important" ? view : null;
  // A list that is gone (deleted on another machine) shows the default one
  const list = smart
    ? null
    : (index.lists.find((l) => l.id === view) ??
      index.lists.find((l) => l.id === DEFAULT_LIST_ID) ??
      null);
  const listId = list?.id ?? DEFAULT_LIST_ID;
  const lists = orderedLists(index);

  const placed: Placed[] = smart
    ? smartList(smart, lists, tasks, today)
    : (tasks[listId] ?? [])
        .slice()
        .sort(compareTasks)
        .map((task) => ({ listId, task }));
  const open = placed.filter((p) => !p.task.done);
  const done = placed
    .filter((p) => p.task.done)
    .sort((a, b) => (b.task.doneAt ?? "").localeCompare(a.task.doneAt ?? ""));
  const doneShown = showDone || done.some((p) => p.task.id === openTaskId);
  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? "";

  const title = smart ? SMART_TITLE[smart] : (list?.name ?? "Tasks");

  const add = (fields: { title: string; due?: string }) => {
    const id = api.addTask(listId, {
      ...fields,
      ...(view === "my-day" ? { myDay: today } : {}),
      ...(view === "important" ? { important: true } : {}),
    });
    if (id) setJustAdded(id);
  };

  const findPlaced = (id: string): Placed | undefined => {
    for (const [listOf, list] of Object.entries(tasks)) {
      const task = list.find((t) => t.id === id);
      if (task) return { listId: listOf, task };
    }
  };

  // The side pane shows the open task wherever it is: it stays open when the task is moved to another list
  const openPlaced = openTaskId ? findPlaced(openTaskId) : undefined;
  // The pane keeps the task it showed while it slides out, so it does not empty before it is gone
  const lastOpen = useRef<Placed | undefined>(undefined);
  if (openPlaced) lastOpen.current = openPlaced;
  const shown = openPlaced ?? lastOpen.current;

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(null), 300);
    return () => clearTimeout(t);
  }, [justAdded]);

  // A task that is in the open list of this view on one render and not on the next has left it: ticked, deleted,
  // moved, or let go of by a change from elsewhere. It stays at its place for ROW_LEAVE_MS, folding away. This runs
  // before the screen is painted, so the row is never missing in between. A switch of view is not a leaving.
  useLayoutEffect(() => {
    const prev = prevRows.current;
    prevRows.current = { view, rows: open };
    if (still || prev.view !== view) return;
    const kept = new Set(open.map((p) => p.task.id));
    const gone: Leaving[] = [];
    prev.rows.forEach((p, at) => {
      if (!kept.has(p.task.id))
        gone.push({ view, at, placed: findPlaced(p.task.id) ?? p });
    });
    if (gone.length === 0) return;
    setLeaving((cur) => [...cur, ...gone]);
    const ids = new Set(gone.map((l) => l.placed.task.id));
    setTimeout(
      () => setLeaving((cur) => cur.filter((l) => !ids.has(l.placed.task.id))),
      ROW_LEAVE_MS,
    );
  });

  const remove = (p: Placed) => {
    const removed = api.deleteTask(p.listId, p.task.id);
    // Another task's details stay open when this one is deleted from its menu
    if (p.task.id === openTaskId) onOpenTask(null);
    if (removed) onTaskDeleted(p.listId, removed);
  };

  const openTask = (id: string, byKeyboard: boolean) => {
    setFocusDetail(byKeyboard);
    onOpenTask(id);
  };

  // A task's right-click menu: what the star, the checkbox and the details pane do, within reach of the row
  const taskEntries = (p: Placed): MenuEntry[] => {
    const { task, listId: from } = p;
    const inMyDay = task.myDay === today;
    return [
      {
        label: "Open details",
        icon: <ChevronRightIcon size={14} />,
        onSelect: () => openTask(task.id, false),
      },
      "separator",
      {
        label: task.done ? "Mark as not done" : "Mark as done",
        icon: <CircleCheckIcon size={14} />,
        onSelect: () => api.setDone(from, task.id, !task.done),
      },
      {
        label: task.important ? "Not important" : "Mark as important",
        icon: <StarIcon size={14} filled={!!task.important} />,
        onSelect: () =>
          api.updateTask(from, task.id, { important: !task.important }),
      },
      {
        label: inMyDay ? "Remove from My Day" : "Add to My Day",
        icon: <SunIcon size={14} />,
        onSelect: () =>
          api.updateTask(from, task.id, { myDay: inMyDay ? null : today }),
      },
      {
        label: "Due date",
        icon: <CalendarIcon size={14} />,
        submenu: [
          {
            label: "Today",
            checked: task.due === today,
            onSelect: () => api.updateTask(from, task.id, { due: today }),
          },
          {
            label: "Tomorrow",
            checked: task.due === nextDay(today),
            onSelect: () =>
              api.updateTask(from, task.id, { due: nextDay(today) }),
          },
          "separator",
          {
            label: "Remove due date",
            disabled: !task.due,
            onSelect: () => api.updateTask(from, task.id, { due: null }),
          },
        ],
      },
      {
        label: "Move to list",
        icon: <FolderInputIcon size={14} />,
        submenu: lists.map((l) => ({
          label: l.name,
          checked: l.id === from,
          onSelect: () => api.moveTask(from, l.id, task.id),
        })),
      },
      "separator",
      {
        label: "Copy title",
        icon: <CopyIcon size={14} />,
        onSelect: () => copy(task.title),
      },
      "separator",
      {
        label: "Delete task",
        icon: <TrashIcon size={14} />,
        danger: true,
        onSelect: () => remove(p),
      },
    ];
  };

  // Escape closes the pane from anywhere but a text field (the pane handles its own fields)
  useEscape(() => onOpenTask(null), {
    active: !!openPlaced,
    when: () => !isTextField(document.activeElement),
  });

  // Only the open tasks of a list's own view can be put in another place
  const row = (p: Placed, draggable: boolean, motion?: "enter" | "leaving") => (
    <TaskRow
      key={p.task.id}
      task={p.task}
      listId={p.listId}
      listName={smart ? listName(p.listId) : null}
      today={today}
      selected={openTaskId === p.task.id}
      showMyDay={view !== "my-day"}
      api={api}
      onOpen={openTask}
      onContextMenu={(e) => openMenu(e, taskEntries(p))}
      onHeadPointerDown={
        onTaskPointerDown && draggable && !smart
          ? (e) => onTaskPointerDown(e, p.task)
          : undefined
      }
      motion={motion}
    />
  );

  // The open tasks, with the ones that just left folding away at the place they had
  const openRows = open.map((p) =>
    row(p, true, p.task.id === justAdded ? "enter" : undefined),
  );
  const stillOpen = new Set(open.map((p) => p.task.id));
  const folding = leaving
    .filter((l) => l.view === view && !stillOpen.has(l.placed.task.id))
    .sort((a, b) => a.at - b.at);
  for (const l of folding)
    openRows.splice(
      Math.min(l.at, openRows.length),
      0,
      row(l.placed, false, "leaving"),
    );

  return (
    <div className="tasks-pane">
      <div className="tasks-pane__main">
        <div className="item-header" data-tauri-drag-region>
          {renaming && list ? (
            <InlineInput
              initial={list.name}
              className="tasks-pane__rename"
              ariaLabel="List name"
              onCommit={(name) => {
                api.updateList(list.id, { name });
                setRenaming(false);
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : list ? (
            <h2 className="tasks-pane__title">
              <button
                type="button"
                className="tasks-pane__title-btn"
                title="Rename list"
                onClick={() => setRenaming(true)}
              >
                {title}
              </button>
            </h2>
          ) : (
            <h2 className="tasks-pane__title">{title}</h2>
          )}
          <span className="tasks-pane__count">
            {view === "my-day" ? `${longDay(today)} · ` : ""}
            {open.length} open
          </span>
          <div className="item-header__spacer" data-tauri-drag-region />
        </div>

        <div className="tasks-pane__body">
          <div className="tasks-pane__column">
            <AddTask
              placeholder="Add a task"
              today={today}
              onAdd={add}
              focusSignal={addSignal}
            />

            {placed.length === 0 && (
              <p className="tasks-pane__empty">{EMPTY_TEXT[smart ?? "list"]}</p>
            )}

            {openRows.length > 0 && (
              <ul className="tasks-pane__list">{openRows}</ul>
            )}

            {done.length > 0 && (
              <>
                <button
                  type="button"
                  className="tasks-pane__done-toggle"
                  aria-expanded={doneShown}
                  onClick={() => setShowDone(!showDone)}
                >
                  <span
                    className={`chevron-turn${doneShown ? " chevron-turn--open" : ""}`}
                    aria-hidden="true"
                  >
                    <ChevronRightIcon size={12} />
                  </span>
                  Completed
                  <span>{done.length}</span>
                </button>
                {doneShown && (
                  <ul className="tasks-pane__list">
                    {done.map((p) => row(p, false))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`tasks-pane__details${openPlaced ? "" : " tasks-pane__details--hidden"}`}
      >
        {shown && (
          <TaskDetail
            // Each task, and each opening, gets a fresh pane (its fields start from the task as it is now)
            key={openPlaced ? shown.task.id : "closing"}
            task={shown.task}
            listId={shown.listId}
            today={today}
            lists={lists}
            api={api}
            focusTitle={!!openPlaced && focusDetail}
            onClose={() => onOpenTask(null)}
            onDelete={() => remove(shown)}
          />
        )}
      </div>
    </div>
  );
}

export default TasksPane;
