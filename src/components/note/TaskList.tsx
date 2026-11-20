// src/components/note/TaskList.tsx
import { type ComponentProps, createContext, useContext } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { MARKDOWN_COMPONENTS } from "../../lib/markdown";
import VaultImage from "./VaultImage";

/** What the checkboxes of a rendered note can do. */
export interface TaskActions {
  toggle: (offset: number) => void;
}

export const TaskActionsContext = createContext<TaskActions | null>(null);

// Where the task whose <li> we are inside starts in the note's text (react-markdown's own position)
const TaskOffsetContext = createContext<number | null>(null);

function TaskItem({
  node,
  className,
  children,
  ...rest
}: ComponentProps<"li"> & ExtraProps) {
  const offset = node?.position?.start.offset;
  if (offset === undefined || !className?.includes("task-list-item")) {
    return (
      <li className={className} {...rest}>
        {children}
      </li>
    );
  }
  return (
    <li className={className} {...rest}>
      <TaskOffsetContext.Provider value={offset}>
        {children}
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
