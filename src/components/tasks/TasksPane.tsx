// src/components/tasks/TasksPane.tsx
import { useState } from "react";
import type { TasksApi } from "../../hooks/useTasks";
import { longDay } from "../../lib/taskDates";
import {
  compareTasks,
  DEFAULT_LIST_ID,
  orderedLists,
  type Placed,
  type SmartList,
  smartList,
  type Task,
} from "../../lib/taskStore";
import { ChevronDownIcon, ChevronRightIcon } from "../ui/Icon";
import InlineInput from "../ui/InlineInput";
import AddTask from "./AddTask";
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
    api.addTask(listId, {
      ...fields,
      ...(view === "my-day" ? { myDay: today } : {}),
      ...(view === "important" ? { important: true } : {}),
    });
  };

  const remove = (p: Placed) => {
    const removed = api.deleteTask(p.listId, p.task.id);
    onOpenTask(null);
    if (removed) onTaskDeleted(p.listId, removed);
  };

  // Only the open tasks of a list's own view can be put in another place
  const row = (p: Placed, draggable: boolean) => (
    <TaskRow
      key={p.task.id}
      task={p.task}
      listId={p.listId}
      listName={smart ? listName(p.listId) : null}
      today={today}
      expanded={openTaskId === p.task.id}
      showMyDay={view !== "my-day"}
      lists={lists}
      api={api}
      onOpen={onOpenTask}
      onDelete={() => remove(p)}
      onHeadPointerDown={
        onTaskPointerDown && draggable && !smart
          ? (e) => onTaskPointerDown(e, p.task)
          : undefined
      }
    />
  );

  return (
    <div className="tasks-pane">
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

          {open.length > 0 && (
            <ul className="tasks-pane__list">
              {open.map((p) => row(p, true))}
            </ul>
          )}

          {done.length > 0 && (
            <>
              <button
                type="button"
                className="tasks-pane__done-toggle"
                aria-expanded={doneShown}
                onClick={() => setShowDone(!showDone)}
              >
                {doneShown ? (
                  <ChevronDownIcon size={12} />
                ) : (
                  <ChevronRightIcon size={12} />
                )}
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
  );
}

export default TasksPane;
