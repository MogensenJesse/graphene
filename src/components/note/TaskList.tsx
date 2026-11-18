// src/components/note/TaskList.tsx
import {
  Children,
  type ComponentProps,
  cloneElement,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
} from "react";
import type { Components, ExtraProps } from "react-markdown";
import { clearDropMarks, markDrop } from "../../lib/dragDrop";
import { MARKDOWN_COMPONENTS } from "../../lib/markdown";
import { DUE_SPLIT, dueStatus, localDate } from "../../lib/tasks";
import { GripVerticalIcon } from "../ui/Icon";
import VaultImage from "./VaultImage";

/** What the checkboxes of a rendered note can do. `move` is set on to-do notes, which can be reordered. */
export interface TaskActions {
  toggle: (offset: number) => void;
  move?: (from: number, to: number, after: boolean) => void;
}

export const TaskActionsContext = createContext<TaskActions | null>(null);

// Where the task whose <li> we are inside starts in the note's text (react-markdown's own position)
const TaskOffsetContext = createContext<number | null>(null);

/** The task to drop next to: the innermost one the pointer's height falls in, else the nearest (gaps, above the first, below the last). */
function taskRowAt(y: number): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  let bestHeight = Infinity;
  for (const li of document.querySelectorAll<HTMLElement>(
    "li[data-task-offset]",
  )) {
    const r = li.getBoundingClientRect();
    if (r.height === 0) continue; // hidden: done tasks while they are hidden
    const dist = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    if (dist < bestDist || (dist === bestDist && r.height < bestHeight)) {
      best = li;
      bestDist = dist;
      bestHeight = r.height;
    }
  }
  return best;
}

/** What the ghost says: the task's own text, not its sub-tasks'. */
function taskLabel(li: HTMLElement): string {
  const copy = li.cloneNode(true) as HTMLElement;
  for (const el of copy.querySelectorAll("ul, ol, .task-grip")) el.remove();
  return copy.textContent?.trim() ?? "";
}

/**
 * Follows the pointer with a ghost label and marks the task nearest to its height as the drop spot
 * (anywhere across the note pane, not only over the text) until the button is released, then reports the move.
 */
function startTaskDrag(
  e: React.PointerEvent,
  from: number,
  move: (from: number, to: number, after: boolean) => void,
): void {
  if (e.button !== 0) return;
  e.preventDefault();
  const grip = e.currentTarget as HTMLElement;
  const row = grip.closest("li");
  const pane = grip.closest(".note-detail__body");
  const label = row ? taskLabel(row) : "";
  let ghost: HTMLDivElement | null = null;
  let target: { to: number; after: boolean } | null = null;

  const onMove = (ev: PointerEvent) => {
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    if (!ghost) {
      ghost = document.createElement("div");
      ghost.className = "drag-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = label;
      document.body.append(ghost);
    }
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    // Outside the note pane (the sidebar, the window edge) there is no drop spot
    const box = pane?.getBoundingClientRect();
    const li =
      box && (ev.clientX < box.left || ev.clientX > box.right)
        ? null
        : taskRowAt(ev.clientY);
    if (!li) {
      target = null;
      markDrop(null);
      return;
    }
    const r = li.getBoundingClientRect();
    const after = ev.clientY > r.top + r.height / 2;
    // "Before a task" is drawn under the task above it when there is a visible one, so the line does not
    // jump when the pointer crosses the middle of the gap (rows of a loose list have space between them)
    const above = after ? null : li.previousElementSibling;
    if (
      above instanceof HTMLElement &&
      above.matches("li[data-task-offset]") &&
      above.getBoundingClientRect().height > 0
    )
      markDrop(above, true);
    else markDrop(li, after);
    target = { to: Number(li.dataset.taskOffset), after };
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    clearDropMarks();
    ghost?.remove();
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (target) move(from, target.to, target.after);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/** "due:2026-12-01" in a task's text becomes a chip; code and nested lists are left alone. */
function withDue(node: ReactNode, today: string): ReactNode {
  return Children.map(node, (child) => {
    if (typeof child === "string") {
      const parts = child.split(DUE_SPLIT);
      if (parts.length === 1) return child;
      return parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const date = part.slice(4);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: parts of one string never reorder
            key={i}
            className={`due-chip due-chip--${dueStatus(date, today)}`}
          >
            due {date}
          </span>
        );
      });
    }
    if (
      isValidElement<{ children?: ReactNode }>(child) &&
      child.props.children !== undefined &&
      !["ul", "ol", "code", "pre"].includes(child.type as string)
    ) {
      return cloneElement(
        child,
        undefined,
        withDue(child.props.children, today),
      );
    }
    return child;
  });
}

function TaskItem({
  node,
  className,
  children,
  ...rest
}: ComponentProps<"li"> & ExtraProps) {
  const actions = useContext(TaskActionsContext);
  const offset = node?.position?.start.offset;
  if (
    !actions ||
    offset === undefined ||
    !className?.includes("task-list-item")
  ) {
    return (
      <li className={className} {...rest}>
        {children}
      </li>
    );
  }
  const { move } = actions;
  return (
    <li className={className} data-task-offset={offset} {...rest}>
      {move && (
        <span
          className="task-grip"
          aria-hidden="true"
          onPointerDown={(e) => startTaskDrag(e, offset, move)}
        >
          <GripVerticalIcon size={12} />
        </span>
      )}
      <TaskOffsetContext.Provider value={offset}>
        {withDue(children, localDate())}
      </TaskOffsetContext.Provider>
    </li>
  );
}

function TaskInput({
  node: _node,
  type,
  checked,
  disabled: _disabled,
  ...rest
}: ComponentProps<"input"> & ExtraProps) {
  const actions = useContext(TaskActionsContext);
  const offset = useContext(TaskOffsetContext);
  if (type !== "checkbox" || !actions || offset === null) {
    return <input type={type} checked={checked} disabled {...rest} />;
  }
  return (
    <input
      type="checkbox"
      checked={!!checked}
      aria-label="Done"
      onChange={() => actions.toggle(offset)}
    />
  );
}

/** The note view's markdown components: the shared ones, plus working checkboxes and vault images. */
export const NOTE_COMPONENTS: Components = {
  ...MARKDOWN_COMPONENTS,
  li: TaskItem,
  input: TaskInput,
  img: VaultImage,
};
