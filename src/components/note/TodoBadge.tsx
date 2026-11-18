// src/components/note/TodoBadge.tsx
import { useMemo } from "react";
import { isTodoBody, taskProgress } from "../../lib/tasks";

/** "2/5 done" in the header of a to-do note; nothing for any other note. */
function TodoBadge({ body }: { body: string }) {
  const { done, total } = useMemo(() => taskProgress(body), [body]);
  if (!isTodoBody(body)) return null;
  return (
    <span className="item-header__badge">
      {done}/{total} done
    </span>
  );
}

export default TodoBadge;
