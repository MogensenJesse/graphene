// src/components/tasks/TaskRow.tsx
import type { TasksApi } from "../../hooks/useTasks";
import { dueLabel } from "../../lib/taskDates";
import { dueStatus, type Task, type TaskList } from "../../lib/taskStore";
import {
  CalendarIcon,
  ChevronUpIcon,
  NoteIcon,
  StarIcon,
  SunIcon,
} from "../ui/Icon";
import Tooltip from "../ui/Tooltip";
import TaskDetail from "./TaskDetail";

interface TaskRowProps {
  task: Task;
  listId: string;
  /** Shown in the meta line when the view mixes lists (My Day, Important). */
  listName: string | null;
  today: string;
  expanded: boolean;
  /** Whether to show the sun of a task that is in My Day (not in My Day's own view, where all are). */
  showMyDay: boolean;
  lists: TaskList[];
  api: TasksApi;
  onOpen: (id: string | null) => void;
  onDelete: () => void;
  /** A press on the row's head that may start a drag (see useDragToFolder). */
  onHeadPointerDown?: (e: React.PointerEvent) => void;
}

/** One task: a round checkbox, the title with a quiet line of facts under it, a star. A click opens it in place. */
function TaskRow({
  task,
  listId,
  listName,
  today,
  expanded,
  showMyDay,
  lists,
  api,
  onOpen,
  onDelete,
  onHeadPointerDown,
}: TaskRowProps) {
  const steps = task.steps.length;
  const stepsDone = task.steps.filter((s) => s.done).length;
  const status = task.due ? dueStatus(task.due, today) : null;
  const inMyDay = task.myDay === today;

  const commitTitle = (input: HTMLInputElement) => {
    const title = input.value.trim();
    if (title && title !== task.title)
      api.updateTask(listId, task.id, { title });
    else input.value = task.title;
  };

  return (
    <li
      className={`task-row${expanded ? " task-row--open" : ""}${task.done ? " task-row--done" : ""}`}
      data-task-id={task.id}
      data-sort-kind="task"
      data-sort-id={task.id}
      data-sort-parent={listId}
    >
      <div
        className="task-row__head"
        onPointerDown={(e) => {
          // The checkbox, the star and the open title are for clicking and typing, not for dragging
          if (expanded || !onHeadPointerDown) return;
          if (
            e.target instanceof Element &&
            e.target.closest("input, .task-row__icon-btn")
          )
            return;
          onHeadPointerDown(e);
        }}
      >
        <input
          type="checkbox"
          className="task-row__check"
          checked={task.done}
          aria-label={task.done ? "Mark as not done" : "Mark as done"}
          onChange={() => api.setDone(listId, task.id, !task.done)}
        />
        {expanded ? (
          <input
            className="task-row__title-input"
            type="text"
            defaultValue={task.title}
            aria-label="Task title"
            onBlur={(e) => commitTitle(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing)
                e.currentTarget.blur();
            }}
          />
        ) : (
          <button
            type="button"
            className="task-row__main"
            onClick={() => onOpen(task.id)}
          >
            <span className="task-row__title">{task.title}</span>
            {(steps > 0 ||
              task.due ||
              task.note ||
              listName ||
              (showMyDay && inMyDay)) && (
              <span className="task-row__meta">
                {listName && <span>{listName}</span>}
                {showMyDay && inMyDay && (
                  <span className="task-row__fact" title="In My Day">
                    <SunIcon size={11} />
                  </span>
                )}
                {steps > 0 && (
                  <span>
                    {stepsDone} of {steps}
                  </span>
                )}
                {task.due && status && (
                  <span
                    className={`task-row__fact task-row__due task-row__due--${task.done ? "later" : status}`}
                  >
                    <CalendarIcon size={11} />
                    {dueLabel(task.due, today)}
                  </span>
                )}
                {task.note && (
                  <span className="task-row__fact" title="Has a note">
                    <NoteIcon size={11} />
                  </span>
                )}
              </span>
            )}
          </button>
        )}
        {expanded && (
          <Tooltip label="Close">
            <button
              type="button"
              className="task-row__icon-btn"
              aria-label="Close"
              onClick={() => onOpen(null)}
            >
              <ChevronUpIcon size={14} />
            </button>
          </Tooltip>
        )}
        <Tooltip label={task.important ? "Not important" : "Important"}>
          <button
            type="button"
            className={`task-row__icon-btn task-row__star${task.important ? " task-row__star--on" : ""}`}
            aria-label={task.important ? "Not important" : "Mark as important"}
            aria-pressed={!!task.important}
            onClick={() =>
              api.updateTask(listId, task.id, { important: !task.important })
            }
          >
            <StarIcon size={15} filled={!!task.important} />
          </button>
        </Tooltip>
      </div>
      {expanded && (
        <TaskDetail
          task={task}
          listId={listId}
          today={today}
          lists={lists}
          api={api}
          onClose={() => onOpen(null)}
          onDelete={onDelete}
        />
      )}
    </li>
  );
}

export default TaskRow;
