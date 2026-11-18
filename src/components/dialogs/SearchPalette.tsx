// src/components/dialogs/SearchPalette.tsx
import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Hit, searchItems } from "../../lib/search";
import { formatDate, getFolderPath, itemKind } from "../../lib/utils";
import type { Folder, Item } from "../../types";
import { KindIcon, SearchIcon, XIcon } from "../ui/Icon";
import Modal from "../ui/Modal";
import Tooltip from "../ui/Tooltip";

const RECENT_COUNT = 12;

interface SearchPaletteProps {
  items: Item[];
  folders: Folder[];
  onOpen: (id: string) => void;
  onClose: () => void;
}

const byRecent = (a: Item, b: Item) => b.updatedAt.localeCompare(a.updatedAt);

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
// Words and "phrases" must all match; in:folder, type:todo and -exclude narrow it (see lib/search).
function SearchPalette({
  items,
  folders,
  onOpen,
  onClose,
}: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Typing stays responsive in a big vault: the list catches up when it can
  const deferred = useDeferredValue(query);

  const hits = useMemo<Hit[]>(
    () =>
      deferred.trim()
        ? searchItems(items, deferred)
        : [...items]
            .sort(byRecent)
            .slice(0, RECENT_COUNT)
            .map((item) => ({ item, score: 0, titleMarks: [], snippet: null })),
    [items, deferred],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const move = (delta: number) =>
    setActive((i) =>
      hits.length === 0 ? 0 : (i + delta + hits.length) % hits.length,
    );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) onOpen(hit.item.id);
    }
  };

  const activeHit = hits[active];

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
            activeHit ? `search-palette-${activeHit.item.id}` : undefined
          }
          aria-label="Search notes and code"
          placeholder="Search. Try in:folder  type:todo  -word  “a phrase”"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <Tooltip label="Close" keys="Esc">
          <button
            type="button"
            className="search-palette__close"
            onClick={onClose}
            aria-label="Close search"
          >
            <XIcon size={16} />
          </button>
        </Tooltip>
      </div>

      {hits.length === 0 ? (
        <p className="search-palette__empty">
          {items.length === 0 ? "Nothing here yet" : "No results"}
        </p>
      ) : (
        <div
          ref={listRef}
          id="search-palette-results"
          className="search-palette__list"
          role="listbox"
          aria-label="Results"
        >
          {hits.map(({ item, titleMarks, snippet }, i) => (
            <div
              key={item.id}
              id={`search-palette-${item.id}`}
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              className={`search-palette__row${i === active ? " search-palette__row--active" : ""}`}
              onMouseMove={() => setActive(i)}
              onClick={() => onOpen(item.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen(item.id);
              }}
            >
              <span className="search-palette__icon" aria-hidden="true">
                <KindIcon kind={itemKind(item)} size={16} />
              </span>
              <div className="search-palette__text">
                <div className="search-palette__line">
                  <span className="search-palette__title">
                    {item.title ? (
                      <Marked text={item.title} marks={titleMarks} />
                    ) : (
                      "Untitled"
                    )}
                  </span>
                  <span className="search-palette__path">
                    {getFolderPath(folders, item.folderId).join(" / ")}
                  </span>
                  <span className="search-palette__date">
                    {formatDate(item.updatedAt)}
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
          ))}
        </div>
      )}
    </Modal>
  );
}

export default SearchPalette;
