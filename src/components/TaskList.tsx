// src/components/TaskList.tsx
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
import { MARKDOWN_COMPONENTS } from "../lib/markdown";
import { DUE_SPLIT, dueStatus, localDate } from "../lib/tasks";
import { GripVerticalIcon } from "./Icon";
import VaultImage from "./VaultImage";

/** What the checkboxes of a rendered note can do. `move` is set on to-do notes, which can be reordered. */
export interface TaskActions {
  toggle: (offset: number) => void;
  move?: (from: number, to: number, after: boolean) => void;
}

export const TaskActionsContext = createContext<TaskActions | null>(null);

// Where the task whose <li> we are inside starts in the note's text (react-markdown's own position)
const TaskOffsetContext = createContext<number | null>(null);

/** Marks the task under the pointer as the drop spot until the button is released, then reports the move. */
function startTaskDrag(
  e: React.PointerEvent,
  from: number,
  move: (from: number, to: number, after: boolean) => void,
): void {
  if (e.button !== 0) return;
  e.preventDefault();
  let target: { to: number; after: boolean } | null = null;
  const clear = () => {
    for (const el of document.querySelectorAll("[data-drop]"))
      el.removeAttribute("data-drop");
  };

  const onMove = (ev: PointerEvent) => {
    clear();
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    // The innermost task under the pointer comes first
    const li = document
      .elementsFromPoint(ev.clientX, ev.clientY)
      .find((el): el is HTMLElement => el.matches("li[data-task-offset]"));
    if (!li) {
      target = null;
      return;
    }
    const r = li.getBoundingClientRect();
    const after = ev.clientY > r.top + r.height / 2;
    li.dataset.drop = after ? "after" : "before";
    target = { to: Number(li.dataset.taskOffset), after };
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    clear();
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
