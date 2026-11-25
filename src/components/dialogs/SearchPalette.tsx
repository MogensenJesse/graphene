// src/components/dialogs/SearchPalette.tsx
import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Hit,
  holdSearchCache,
  releaseSearchCache,
  searchItems,
  searchTasks,
  type TaskEntry,
  type TaskHit,
} from "../../lib/search";
import { dueLabel } from "../../lib/taskDates";
import { localDate } from "../../lib/taskStore";
import { formatDate, getFolderPath, itemKind } from "../../lib/utils";
import type { Folder, Item } from "../../types";
import { CircleCheckIcon, KindIcon, SearchIcon, XIcon } from "../ui/Icon";
import IconButton from "../ui/IconButton";
import Modal from "../ui/Modal";
import Tooltip from "../ui/Tooltip";

const RECENT_COUNT = 12;

interface SearchPaletteProps {
  items: Item[];
  folders: Folder[];
  /** Every task with its list, searched together with the notes. */
  tasks: TaskEntry[];
  /** The texts of the notes are still being read: title matches are complete, text matches fill in as they arrive. */
  indexing?: boolean;
  onOpen: (id: string) => void;
  onOpenTask: (listId: string, taskId: string) => void;
  onClose: () => void;
}

/** A note or a task, as one row of the results. */
type Result =
  | { kind: "note"; id: string; updatedAt: string; hit: Hit }
  | { kind: "task"; id: string; updatedAt: string; hit: TaskHit };

const noteResult = (hit: Hit): Result => ({
  kind: "note",
  id: hit.item.id,
  updatedAt: hit.item.updatedAt,
  hit,
});
const taskResult = (hit: TaskHit): Result => ({
  kind: "task",
  id: hit.entry.task.id,
  updatedAt: hit.entry.task.updatedAt,
  hit,
});
const byRecent = (a: Result, b: Result) =>
  b.updatedAt.localeCompare(a.updatedAt);

/** `text` with the letters at `marks` highlighted. */
function Marked({ text, marks }: { text: string; marks: number[] }) {
  if (marks.length === 0) return <>{text}</>;
  const on = new Set(marks);
  const parts: ReactNode[] = [];
  for (let i = 0; i < text.length; ) {
    let j = i;
    while (j < text.length && on.has(j) === on.has(i)) j++;
    const chunk = text.slice(i, j);
    parts.push(on.has(i) ? <mark key={i}>{chunk}</mark> : chunk);
    i = j;
  }
  return <>{parts}</>;
}

// Ctrl+K palette: recent items while empty, live results while typing.
// Words and "phrases" must all match; in:folder, type:task and -exclude narrow it (see lib/search).
// Tasks are marked with a check icon and a "Task" tag, and show their list and due date.
function SearchPalette({
  items,
  folders,
  tasks,
  indexing = false,
  onOpen,
  onOpenTask,
  onClose,
}: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  // How far the background read has come, for the hint under the field
  const loaded = useMemo(
    () => (indexing ? items.filter((i) => !i.unloaded).length : 0),
    [items, indexing],
  );
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Typing stays responsive in a big vault: the list catches up when it can
  const deferred = useDeferredValue(query);

  const results = useMemo<Result[]>(() => {
    if (deferred.trim())
      return [
        ...searchItems(items, deferred).map(noteResult),
        ...searchTasks(tasks, deferred).map(taskResult),
      ].sort((a, b) => b.hit.score - a.hit.score || byRecent(a, b));
    // No query: the newest few of each kind, taken in one pass (the search itself lists newest first when it has no terms),
    // then merged, so a vault of thousands of notes is not sorted whole
    return [
      ...searchItems(items, "", RECENT_COUNT).map(noteResult),
      ...searchTasks(tasks, "", RECENT_COUNT).map(taskResult),
    ]
      .sort(byRecent)
      .slice(0, RECENT_COUNT);
  }, [items, tasks, deferred]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The lower-cased copies the search keeps are dropped a while after the palette closes
  useEffect(() => {
    holdSearchCache();
    return releaseSearchCache;
  }, []);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const move = (delta: number) =>
    setActive((i) =>
      results.length === 0 ? 0 : (i + delta + results.length) % results.length,
    );

  const open = (r: Result) =>
    r.kind === "note" ? onOpen(r.id) : onOpenTask(r.hit.entry.listId, r.id);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const result = results[active];
      if (result) open(result);
    }
  };

  const activeResult = results[active];
  const today = localDate();

  return (
    <Modal label="Search" onClose={onClose} className="search-palette">
      <div className="search-palette__input-row">
        <SearchIcon size={16} />
        <input
          ref={inputRef}
          className="search-palette__input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-palette-results"
          aria-activedescendant={
            activeResult ? `search-palette-${activeResult.id}` : undefined
          }
          aria-label="Search notes and tasks"
          placeholder="Search notes and tasks. Try in:folder  type:task  -word  “a phrase”"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <Tooltip label="Close" keys="Esc">
          <IconButton onClick={onClose} aria-label="Close search">
            <XIcon size={16} />
          </IconButton>
        </Tooltip>
      </div>

      {indexing && (
        <p className="search-palette__hint" role="status">
          Indexing… {loaded} of {items.length} notes. Titles are searchable now;
          text matches appear as notes load.
        </p>
      )}

      {results.length === 0 ? (
        <p className="search-palette__empty">
          {items.length === 0 && tasks.length === 0
            ? "Nothing here yet"
            : "No results"}
        </p>
      ) : (
        <div
          ref={listRef}
          id="search-palette-results"
          className="search-palette__list"
          role="listbox"
          aria-label="Results"
        >
          {results.map((r, i) => {
            const isTask = r.kind === "task";
            const title = isTask ? r.hit.entry.task.title : r.hit.item.title;
            const { titleMarks, snippet } = r.hit;
            const done = isTask && r.hit.entry.task.done;
            return (
              <div
                key={r.id}
                id={`search-palette-${r.id}`}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                className={`search-palette__row${i === active ? " search-palette__row--active" : ""}${isTask ? " search-palette__row--task" : ""}${done ? " search-palette__row--done" : ""}`}
                onMouseMove={() => setActive(i)}
                onClick={() => open(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") open(r);
                }}
              >
                <span className="search-palette__icon" aria-hidden="true">
                  {r.kind === "note" ? (
                    <KindIcon kind={itemKind(r.hit.item)} size={16} />
                  ) : (
                    <CircleCheckIcon size={16} />
                  )}
                </span>
                <div className="search-palette__text">
                  <div className="search-palette__line">
                    <span className="search-palette__title">
                      {title ? (
                        <Marked text={title} marks={titleMarks} />
                      ) : (
                        "Untitled"
                      )}
                    </span>
                    {isTask && (
                      <span className="search-palette__tag">Task</span>
                    )}
                    <span className="search-palette__path">
                      {r.kind === "note"
                        ? getFolderPath(folders, r.hit.item.folderId).join(
                            " / ",
                          )
                        : r.hit.entry.listName}
                    </span>
                    <span className="search-palette__date">
                      {r.kind === "note"
                        ? formatDate(r.hit.item.updatedAt)
                        : r.hit.entry.task.due
                          ? dueLabel(r.hit.entry.task.due, today)
                          : ""}
                    </span>
                  </div>
                  {snippet && (
                    <div className="search-palette__snippet">
                      {snippet.before}
                      <mark>{snippet.match}</mark>
                      {snippet.after}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export default SearchPalette;
