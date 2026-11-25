// src/components/tasks/TaskRow.tsx
import { memo } from "react";
import type { TasksApi } from "../../hooks/useTasks";
import { perfRender } from "../../lib/perf";
import { dueLabel } from "../../lib/taskDates";
import { dueStatus, type Task } from "../../lib/taskStore";
import Checkbox from "../ui/Checkbox";
import { CalendarIcon, NoteIcon, StarIcon, SunIcon } from "../ui/Icon";
import IconButton from "../ui/IconButton";
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
  /** Only the open tasks of a list's own view can be put in another place: a press on the head may start a drag. */
  draggable: boolean;
  // The row is memoised, so what it is given is plain values and functions that keep their identity (see useTasks)
  setDone: TasksApi["setDone"];
  updateTask: TasksApi["updateTask"];
  /** `byKeyboard`: the row was opened with Enter or Space, so the details take the focus. */
  onOpen: (id: string, byKeyboard: boolean) => void;
  /** The row's right-click menu (built by TasksPane). */
  onContextMenu: (e: React.MouseEvent, task: Task, listId: string) => void;
  /** A press on the row's head that may start a drag (see useDragToFolder). */
  onHeadPointerDown?: (e: React.PointerEvent, task: Task) => void;
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
  draggable,
  setDone,
  updateTask,
  onOpen,
  onContextMenu,
  onHeadPointerDown,
  motion,
}: TaskRowProps) {
  perfRender("TaskRow");
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
      onContextMenu={(e) => onContextMenu(e, task, listId)}
    >
      <div
        className="task-row__head"
        onPointerDown={(e) => {
          // The checkbox and the star are for clicking, not for dragging
          if (!draggable || !onHeadPointerDown) return;
          if (
            e.target instanceof Element &&
            e.target.closest("input, .icon-btn")
          )
            return;
          onHeadPointerDown(e, task);
        }}
      >
        <Checkbox
          round
          checked={task.done}
          aria-label={`Mark "${task.title}" as ${task.done ? "not done" : "done"}`}
          onChange={() => setDone(listId, task.id, !task.done)}
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
                <Tooltip label="In My Day">
                  <span
                    className="task-row__fact"
                    role="img"
                    aria-label="In My Day"
                  >
                    <SunIcon size={11} />
                  </span>
                </Tooltip>
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
                <Tooltip label="Has a note">
                  <span
                    className="task-row__fact"
                    role="img"
                    aria-label="Has a note"
                  >
                    <NoteIcon size={11} />
                  </span>
                </Tooltip>
              )}
            </span>
          )}
        </button>
        <Tooltip
          label={task.important ? "Mark as not important" : "Mark as important"}
        >
          <IconButton
            className={task.important ? "task-row__star--on" : undefined}
            aria-label={`Mark "${task.title}" as ${task.important ? "not important" : "important"}`}
            aria-pressed={!!task.important}
            onClick={() =>
              updateTask(listId, task.id, { important: !task.important })
            }
          >
            <StarIcon size={15} filled={!!task.important} />
          </IconButton>
        </Tooltip>
      </div>
    </li>
  );
}

export default memo(TaskRow);
