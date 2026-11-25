// src/components/note/MarkdownBody.tsx
// The rendered text of a note. This is the one place the Markdown pipeline (react-markdown, remark-gfm, rehype-highlight and its
// grammars) is used by the note view, and NoteDetail loads it on demand (`lazy`), so those libraries are not in the first script.
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { REHYPE_PLUGINS, REMARK_PLUGINS } from "../../lib/markdown";
import {
  NOTE_COMPONENTS,
  type TaskActions,
  TaskActionsContext,
} from "./TaskList";

interface MarkdownBodyProps {
  noteId: string;
  body: string;
  /** Tick or untick the checkbox whose marker starts at `offset` in the note's text */
  onToggleTask: (id: string, offset: number) => void;
}

function MarkdownBody({ noteId, body, onToggleTask }: MarkdownBodyProps) {
  const taskActions = useMemo<TaskActions>(
    () => ({ toggle: (offset) => onToggleTask(noteId, offset) }),
    [noteId, onToggleTask],
  );
  return (
    <TaskActionsContext.Provider value={taskActions}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={NOTE_COMPONENTS}
      >
        {body}
      </ReactMarkdown>
    </TaskActionsContext.Provider>
  );
}

export default MarkdownBody;
