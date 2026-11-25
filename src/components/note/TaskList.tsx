// src/components/note/TaskList.tsx
import { type ComponentProps, createContext, useContext } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { MARKDOWN_COMPONENTS } from "../../lib/markdown";
import Checkbox from "../ui/Checkbox";
import VaultImage from "./VaultImage";

/** What the checkboxes of a rendered note can do. */
export interface TaskActions {
  toggle: (offset: number) => void;
}

export const TaskActionsContext = createContext<TaskActions | null>(null);

// The task whose <li> we are inside: where it starts in the note's text (react-markdown's own position) and its
// words, which name the checkbox
const TaskOffsetContext = createContext<{
  offset: number;
  text: string;
} | null>(null);

interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  children?: HastNode[];
}

// The words of a list item, without the lists nested under it
const wordsOf = (node: HastNode): string =>
  node.type === "text"
    ? (node.value ?? "")
    : node.tagName === "ul" || node.tagName === "ol"
      ? ""
      : (node.children ?? []).map(wordsOf).join("");

function TaskItem({
  node,
  className,
  children,
  ...rest
}: ComponentProps<"li"> & ExtraProps) {
  const offset = node?.position?.start.offset;
  if (!node || offset === undefined || !className?.includes("task-list-item")) {
    return (
      <li className={className} {...rest}>
        {children}
      </li>
    );
  }
  return (
    <li className={className} {...rest}>
      <TaskOffsetContext.Provider
        value={{ offset, text: wordsOf(node).replace(/\s+/g, " ").trim() }}
      >
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
  const task = useContext(TaskOffsetContext);
  if (type !== "checkbox")
    return <input type={type} checked={checked} disabled {...rest} />;
  if (!actions || task === null) {
    return <Checkbox checked={checked} disabled {...rest} />;
  }
  return (
    <Checkbox
      checked={!!checked}
      aria-label={task.text || "Done"}
      onChange={() => actions.toggle(task.offset)}
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
