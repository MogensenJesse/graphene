// src/components/tasks/TaskDetail.tsx
import { useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useEscape } from "../../hooks/useEscape";
import type { TasksApi } from "../../hooks/useTasks";
import { dueLabel } from "../../lib/taskDates";
import type { Step, Task, TaskList } from "../../lib/taskStore";
import { formatDate } from "../../lib/utils";
import DatePick from "../ui/DatePick";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListIcon,
  PlusIcon,
  StarIcon,
  SunIcon,
  TrashIcon,
  XIcon,
} from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

interface TaskDetailProps {
  task: Task;
  listId: string;
  today: string;
  lists: TaskList[];
  api: TasksApi;
  /** The task was opened from the keyboard: its title takes the focus. */
  focusTitle: boolean;
  onClose: () => void;
  onDelete: () => void;
}

interface StepLineProps {
  step: Step;
  onDone: (done: boolean) => void;
  onRename: (title: string) => void;
  onRemove: () => void;
}

function StepLine({ step, onDone, onRename, onRemove }: StepLineProps) {
  return (
    <li
      className={`task-detail__step${step.done ? " task-detail__step--done" : ""}`}
    >
      <input
        type="checkbox"
        className="task-row__check"
        checked={step.done}
        aria-label={step.done ? "Mark step as not done" : "Mark step as done"}
        onChange={() => onDone(!step.done)}
      />
      <input
        className="task-detail__step-title"
        type="text"
        defaultValue={step.title}
        aria-label="Step"
        onBlur={(e) => {
          const title = e.currentTarget.value.trim();
          if (title && title !== step.title) onRename(title);
          else e.currentTarget.value = step.title;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing)
            e.currentTarget.blur();
        }}
      />
      <button
        type="button"
        className="task-row__icon-btn"
        aria-label="Delete step"
        onClick={onRemove}
      >
        <XIcon size={12} />
      </button>
    </li>
  );
}

interface ListPickerProps {
  lists: TaskList[];
  value: string;
  onChange: (id: string) => void;
}

/** The list row: the task's list, and a dropdown of all of them. It has the look and the behaviour of the note's folder picker (click outside or Escape closes it). */
function ListPicker({ lists, value, onChange }: ListPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useClickOutside(wrapRef, open, () => setOpen(false));
  useEscape(() => setOpen(false), { active: open, capture: true });

  return (
    <div className="task-detail__option" ref={wrapRef}>
      <button
        type="button"
        className="task-detail__option-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="List"
        onClick={() => setOpen((v) => !v)}
      >
        <ListIcon size={14} />
        {lists.find((l) => l.id === value)?.name}
        <span className="task-detail__chevron" aria-hidden="true">
          <ChevronDownIcon size={12} />
        </span>
      </button>

      {open && (
        <div className="folder-picker__dropdown" role="menu">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitem"
              className={`folder-picker__option${l.id === value ? " folder-picker__option--selected" : ""}`}
              onClick={() => {
                onChange(l.id);
                setOpen(false);
              }}
            >
              <span className="folder-picker__option-icon" aria-hidden="true">
                <ListIcon size={14} />
              </span>
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The side pane of the open task: its title, steps, My Day, a due date, its list, a note, and Delete. TasksPane keys it by task, so every field starts from the task it shows. */
function TaskDetail({
  task,
  listId,
  today,
  lists,
  api,
  focusTitle,
  onClose,
  onDelete,
}: TaskDetailProps) {
  const [step, setStep] = useState("");
  const inMyDay = task.myDay === today;

  const addStep = () => {
    if (!step.trim()) return;
    api.addStep(listId, task.id, step);
    setStep("");
  };

  const commitTitle = (input: HTMLTextAreaElement) => {
    const title = input.value.trim();
    if (title && title !== task.title)
      api.updateTask(listId, task.id, { title });
    else input.value = task.title;
  };

  // A field still being typed in is committed by its blur before the pane goes; the focus goes back to the row
  const close = () => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    onClose();
    document
      .querySelector<HTMLElement>(`[data-task-id="${task.id}"] .task-row__main`)
      ?.focus();
  };

  return (
    <aside
      className="task-detail"
      aria-label="Task details"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="task-detail__bar" data-tauri-drag-region>
        <Tooltip label="Close" keys="Esc">
          <button
            type="button"
            className="item-header__btn item-header__btn--icon item-header__btn--quiet"
            aria-label="Close details"
            onClick={close}
          >
            <ChevronRightIcon size={16} />
          </button>
        </Tooltip>
      </div>

      <div className="task-detail__body">
        <div className="task-detail__head">
          <input
            type="checkbox"
            className="task-row__check"
            checked={task.done}
            aria-label={task.done ? "Mark as not done" : "Mark as done"}
            onChange={() => api.setDone(listId, task.id, !task.done)}
          />
          {/* A textarea so a long title wraps; Enter commits it, and cleanTitle makes any pasted line break a space */}
          <textarea
            className="task-detail__title"
            rows={1}
            defaultValue={task.title}
            aria-label="Task title"
            // biome-ignore lint/a11y/noAutofocus: a task opened from the keyboard hands the focus to its details
            autoFocus={focusTitle}
            onBlur={(e) => commitTitle(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
          <Tooltip label={task.important ? "Not important" : "Important"}>
            <button
              type="button"
              className={`task-row__icon-btn task-row__star${task.important ? " task-row__star--on" : ""}`}
              aria-label={
                task.important ? "Not important" : "Mark as important"
              }
              aria-pressed={!!task.important}
              onClick={() =>
                api.updateTask(listId, task.id, { important: !task.important })
              }
            >
              <StarIcon size={15} filled={!!task.important} />
            </button>
          </Tooltip>
        </div>

        {task.steps.length > 0 && (
          <ul className="task-detail__steps">
            {task.steps.map((s) => (
              <StepLine
                key={s.id}
                step={s}
                onDone={(done) =>
                  api.updateStep(listId, task.id, s.id, { done })
                }
                onRename={(title) =>
                  api.updateStep(listId, task.id, s.id, { title })
                }
                onRemove={() => api.removeStep(listId, task.id, s.id)}
              />
            ))}
          </ul>
        )}
        <div className="task-detail__add-step">
          <PlusIcon size={13} />
          <input
            type="text"
            className="task-detail__step-title"
            value={step}
            placeholder="Add a step"
            aria-label="Add a step"
            onChange={(e) => setStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addStep();
              }
            }}
          />
        </div>

        {/* One card of rows: an icon, then what it sets */}
        <div className="task-detail__options">
          <div className="task-detail__option">
            <button
              type="button"
              className={`task-detail__option-btn${inMyDay ? " task-detail__option-btn--on" : ""}`}
              aria-pressed={inMyDay}
              onClick={() =>
                api.updateTask(listId, task.id, {
                  myDay: inMyDay ? null : today,
                })
              }
            >
              <SunIcon size={14} />
              {inMyDay ? "In My Day" : "Add to My Day"}
            </button>
          </div>

          <div className="task-detail__option">
            <DatePick
              value={task.due ?? ""}
              onChange={(due) => api.updateTask(listId, task.id, { due })}
              label="Due date"
              className={`task-detail__option-btn${task.due ? " task-detail__option-btn--on" : ""}`}
            >
              <CalendarIcon size={14} />
              {task.due ? `Due ${dueLabel(task.due, today)}` : "Add due date"}
            </DatePick>
            {task.due && (
              <button
                type="button"
                className="task-row__icon-btn"
                aria-label="Remove due date"
                onClick={() => api.updateTask(listId, task.id, { due: null })}
              >
                <XIcon size={12} />
              </button>
            )}
          </div>

          <ListPicker
            lists={lists}
            value={listId}
            onChange={(to) => api.moveTask(listId, to, task.id)}
          />
        </div>

        <textarea
          className="task-detail__note"
          defaultValue={task.note ?? ""}
          placeholder="Add a note"
          aria-label="Note"
          rows={2}
          onBlur={(e) => {
            if (e.currentTarget.value !== (task.note ?? ""))
              api.updateTask(listId, task.id, { note: e.currentTarget.value });
          }}
        />
      </div>

      <div className="task-detail__foot">
        <span>Created {formatDate(task.createdAt)}</span>
        <button
          type="button"
          className="task-detail__delete"
          onClick={onDelete}
        >
          <TrashIcon size={13} />
          Delete task
        </button>
      </div>
    </aside>
  );
}

export default TaskDetail;
