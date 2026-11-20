// src/components/tasks/TaskDetail.tsx
import { useState } from "react";
import type { TasksApi } from "../../hooks/useTasks";
import { dueLabel } from "../../lib/taskDates";
import type { Step, Task, TaskList } from "../../lib/taskStore";
import { formatDate } from "../../lib/utils";
import DatePick from "../ui/DatePick";
import { CalendarIcon, PlusIcon, SunIcon, TrashIcon, XIcon } from "../ui/Icon";

interface TaskDetailProps {
  task: Task;
  listId: string;
  today: string;
  lists: TaskList[];
  api: TasksApi;
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

/** What opens under a task: steps, My Day, a due date, its list, a note, and Delete. */
function TaskDetail({
  task,
  listId,
  today,
  lists,
  api,
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape closes the details; every field inside is a control of its own
    <div
      className="task-detail"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {task.steps.length > 0 && (
        <ul className="task-detail__steps">
          {task.steps.map((s) => (
            <StepLine
              key={s.id}
              step={s}
              onDone={(done) => api.updateStep(listId, task.id, s.id, { done })}
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

      <div className="task-detail__chips">
        <button
          type="button"
          className={`task-detail__chip${inMyDay ? " task-detail__chip--on" : ""}`}
          aria-pressed={inMyDay}
          onClick={() =>
            api.updateTask(listId, task.id, { myDay: inMyDay ? null : today })
          }
        >
          <SunIcon size={13} />
          {inMyDay ? "In My Day" : "Add to My Day"}
        </button>

        <span className="task-detail__due">
          <DatePick
            value={task.due ?? ""}
            onChange={(due) => api.updateTask(listId, task.id, { due })}
            label="Due date"
            className={`task-detail__chip${task.due ? " task-detail__chip--on" : ""}`}
          >
            <CalendarIcon size={13} />
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
        </span>

        <label className="task-detail__list">
          <span>List</span>
          <select
            value={listId}
            onChange={(e) => api.moveTask(listId, e.target.value, task.id)}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        key={task.id}
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
    </div>
  );
}

export default TaskDetail;
