// src/components/NoteDetail.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useClipboard } from "../hooks/useClipboard";
import { useDomFind, useFindState } from "../hooks/useFind";
import { openLink, REHYPE_PLUGINS, REMARK_PLUGINS } from "../lib/markdown";
import { isTodoItem } from "../lib/utils";
import type { Folder, Item } from "../types";
import type { MenuEntry } from "./ContextMenu";
import { useContextMenu } from "./ContextMenuProvider";
import FindBar from "./FindBar";
import {
  ClipboardCopyIcon,
  ClipboardIcon,
  EditIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  TrashIcon,
} from "./Icon";
import ItemActions from "./ItemActions";
import ItemHeader from "./ItemHeader";
import {
  NOTE_COMPONENTS,
  type TaskActions,
  TaskActionsContext,
} from "./TaskList";
import TodoBadge from "./TodoBadge";
import WordCount from "./WordCount";

const HIDE_DONE_KEY = "graphene.hideDone";

function readHideDone(): boolean {
  try {
    return localStorage.getItem(HIDE_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

interface NoteDetailProps {
  note: Item;
  folders: Folder[];
  onEdit: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  // Tick or untick the task whose marker starts at `offset` in the note's text
  onToggleTask: (id: string, offset: number) => void;
  // Move a task before or after another (to-do notes only)
  onMoveTask: (id: string, from: number, to: number, after: boolean) => void;
  // Goes up on each Ctrl+F; the find bar opens when it changes
  findSignal: number;
  // False while a folder is selected, so the Del key goes to the folder instead
  deleteKeyEnabled: boolean;
}

function NoteDetail({
  note,
  folders,
  onEdit,
  onDelete,
  onRename,
  onMove,
  onToggleTask,
  onMoveTask,
  findSignal,
  deleteKeyEnabled,
}: NoteDetailProps) {
  const markdownRef = useRef<HTMLDivElement>(null);
  // The rendered note text only (not the word count under it), for find
  const textRef = useRef<HTMLDivElement>(null);
  const find = useFindState(findSignal);
  const finder = useDomFind(textRef, find.open ? find.query : "", note.body);
  const { open } = useContextMenu();
  const { copy } = useClipboard();
  const todo = isTodoItem(note);
  const [hideDone, setHideDone] = useState(readHideDone);

  const noteId = note.id;
  const taskActions = useMemo<TaskActions>(
    () => ({
      toggle: (offset) => onToggleTask(noteId, offset),
      move: todo
        ? (from, to, after) => onMoveTask(noteId, from, to, after)
        : undefined,
    }),
    [noteId, todo, onToggleTask, onMoveTask],
  );

  const toggleHideDone = () => {
    const next = !hideDone;
    setHideDone(next);
    try {
      localStorage.setItem(HIDE_DONE_KEY, next ? "1" : "0");
    } catch {
      // Preference only; it still applies for this session
    }
  };

  // What a right-click offers wherever it lands in the note
  const noteEntries: MenuEntry[] = [
    {
      label: "Copy note",
      icon: <ClipboardIcon size={14} />,
      onSelect: () => copy(note.body),
    },
    {
      label: "Edit",
      icon: <EditIcon size={14} />,
      onSelect: onEdit,
    },
    "separator",
    {
      label: "Move to trash",
      icon: <TrashIcon size={14} />,
      danger: true,
      onSelect: () => onDelete(note.id),
    },
  ];

  // Over the text: the selection, a link or a code block under the cursor come first
  const handleBodyMenu = (e: React.MouseEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    const selection = window.getSelection()?.toString() ?? "";
    const href = target?.closest("a[href]")?.getAttribute("href") ?? "";
    const code = target
      ?.closest(".code-block pre")
      ?.textContent?.replace(/\n$/, "");
    const here: MenuEntry[] = [
      ...(selection
        ? [{ label: "Copy", onSelect: () => copy(selection) }]
        : []),
      ...(href
        ? [
            {
              label: "Open link",
              icon: <ExternalLinkIcon size={14} />,
              onSelect: () => openLink(href),
            },
            { label: "Copy link", onSelect: () => copy(href) },
          ]
        : []),
      ...(code
        ? [
            {
              label: "Copy code",
              icon: <ClipboardCopyIcon size={14} />,
              onSelect: () => copy(code),
            },
          ]
        : []),
    ];
    open(e, here.length ? [...here, "separator", ...noteEntries] : noteEntries);
  };

  // Ctrl+C with nothing selected copies the code when the note has exactly one code block.
  // Clicking the block's own copy button keeps the "copied" feedback in one place.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key !== "c") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (window.getSelection()?.toString()) return;
      const buttons =
        markdownRef.current?.querySelectorAll<HTMLButtonElement>(
          ".code-block__copy",
        );
      if (buttons?.length !== 1) return;
      e.preventDefault();
      buttons[0].click();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click is a mouse shortcut; every entry has a button or shortcut elsewhere
    <div
      className={`note-detail${todo && hideDone ? " note-detail--hide-done" : ""}`}
      onContextMenu={(e) => open(e, noteEntries)}
    >
      <ItemHeader
        menuEntries={noteEntries}
        title={note.title}
        onTitleChange={(title) => onRename(note.id, title)}
        folders={folders}
        folderId={note.folderId}
        onFolderChange={(folderId) => onMove(note.id, folderId)}
        badge={
          todo && (
            <>
              <TodoBadge body={note.body} />
              <button
                type="button"
                className="item-header__btn item-header__btn--icon"
                onClick={toggleHideDone}
                aria-pressed={hideDone}
                aria-label="Hide done tasks"
                title={hideDone ? "Show done tasks" : "Hide done tasks"}
              >
                {hideDone ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </>
          )
        }
        updatedAt={note.updatedAt}
        actions={
          <ItemActions
            itemId={note.id}
            body={note.body}
            onEdit={onEdit}
            onDelete={onDelete}
            deleteKeyEnabled={deleteKeyEnabled}
          />
        }
      />

      {find.open && (
        <FindBar
          query={find.query}
          onQueryChange={find.setQuery}
          finder={finder}
          onClose={() => find.setOpen(false)}
          focusKey={findSignal}
        />
      )}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only shortcut, keyboard users have Ctrl+E and the Edit button. Double-click on empty space (not on text, so word-select still works) starts editing */}
      <div
        className="note-detail__body"
        onContextMenu={handleBodyMenu}
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) onEdit();
        }}
      >
        <div className="note-detail__markdown" ref={markdownRef}>
          <div ref={textRef}>
            <TaskActionsContext.Provider value={taskActions}>
              <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                rehypePlugins={REHYPE_PLUGINS}
                components={NOTE_COMPONENTS}
              >
                {note.body}
              </ReactMarkdown>
            </TaskActionsContext.Provider>
          </div>
          <WordCount body={note.body} />
        </div>
      </div>
    </div>
  );
}

export default NoteDetail;
