// src/components/tasks/TaskRow.tsx
import type { TasksApi } from "../../hooks/useTasks";
import { dueLabel } from "../../lib/taskDates";
import { dueStatus, type Task } from "../../lib/taskStore";
import { CalendarIcon, NoteIcon, StarIcon, SunIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

interface TaskRowProps {
  task: Task;
  listId: string;
  /** Shown in the meta line when the view mixes lists (My Day, Important). */
  listName: string | null;
  today: string;
  /** Its details are open in the side pane. */
  selected: boolean;
  /** Whether to show the sun of a task that is in My Day (not in My Day's own view, where all are). */
  showMyDay: boolean;
  api: TasksApi;
  /** `byKeyboard`: the row was opened with Enter or Space, so the details take the focus. */
  onOpen: (id: string, byKeyboard: boolean) => void;
  /** The row's right-click menu (built by TasksPane). */
  onContextMenu: (e: React.MouseEvent) => void;
  /** A press on the row's head that may start a drag (see useDragToFolder). */
  onHeadPointerDown?: (e: React.PointerEvent) => void;
  /** "enter": it was just added and eases in. "leaving": it left the list and folds away; it cannot be reached meanwhile. */
  motion?: "enter" | "leaving";
}

/** One task: a round checkbox, the title with a quiet line of facts under it, a star. A click opens its details in the side pane. */
function TaskRow({
  task,
  listId,
  listName,
  today,
  selected,
  showMyDay,
  api,
  onOpen,
  onContextMenu,
  onHeadPointerDown,
  motion,
}: TaskRowProps) {
  const steps = task.steps.length;
  const stepsDone = task.steps.filter((s) => s.done).length;
  const status = task.due ? dueStatus(task.due, today) : null;
  const inMyDay = task.myDay === today;
  const leaving = motion === "leaving";

  return (
    <li
      className={`task-row${selected ? " task-row--selected" : ""}${task.done ? " task-row--done" : ""}${motion ? ` task-row--${motion}` : ""}`}
      // A leaving row is only a picture: no drag, drop or focus target
      data-task-id={leaving ? undefined : task.id}
      data-sort-kind={leaving ? undefined : "task"}
      data-sort-id={leaving ? undefined : task.id}
      data-sort-parent={leaving ? undefined : listId}
      inert={leaving}
      onContextMenu={onContextMenu}
    >
      <div
        className="task-row__head"
        onPointerDown={(e) => {
          // The checkbox and the star are for clicking, not for dragging
          if (!onHeadPointerDown) return;
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
        <button
          type="button"
          className="task-row__main"
          aria-current={selected}
          onClick={(e) => onOpen(task.id, e.detail === 0)}
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
    </li>
  );
}

export default TaskRow;
