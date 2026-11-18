// src/components/note/TodoBadge.tsx
import { useMemo } from "react";
import { isTodoBody, taskProgress } from "../../lib/tasks";
import { EyeIcon, EyeOffIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

interface TodoBadgeProps {
  body: string;
  // Read view only: the chip is also the switch that hides the ticked tasks
  hideDone?: boolean;
  onToggleHideDone?: () => void;
}

/** "2/5 done" in the header of a to-do note; nothing for any other note. */
function TodoBadge({
  body,
  hideDone = false,
  onToggleHideDone,
}: TodoBadgeProps) {
  const { done, total } = useMemo(() => taskProgress(body), [body]);
  if (!isTodoBody(body)) return null;
  const text = `${done}/${total} done`;
  if (!onToggleHideDone)
    return <span className="item-header__badge">{text}</span>;
  return (
    <Tooltip label={hideDone ? "Show done tasks" : "Hide done tasks"}>
      <button
        type="button"
        className="item-header__badge item-header__badge--toggle"
        onClick={onToggleHideDone}
        aria-pressed={hideDone}
        aria-label={`Hide done tasks, ${text}`}
      >
        {hideDone ? <EyeOffIcon /> : <EyeIcon />}
        {text}
      </button>
    </Tooltip>
  );
}

export default TodoBadge;
