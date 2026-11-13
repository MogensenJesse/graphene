// src/components/SearchPalette.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { filterItems } from "../lib/search";
import { formatDate, getFolderPath, isCodeItem } from "../lib/utils";
import type { Folder, Item } from "../types";
import { CodeIcon, NoteIcon, SearchIcon, XIcon } from "./Icon";
import Modal from "./Modal";

const RECENT_COUNT = 12;
const MAX_RESULTS = 50;

interface SearchPaletteProps {
  items: Item[];
  folders: Folder[];
  onOpen: (id: string) => void;
  onClose: () => void;
}

const byRecent = (a: Item, b: Item) => b.updatedAt.localeCompare(a.updatedAt);

// Ctrl+K palette: recent items while empty, live results while typing
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...items].sort(byRecent).slice(0, RECENT_COUNT);
    // Title matches first, then body-only matches; each group newest first
    const inTitle = (i: Item) => i.title.toLowerCase().includes(q);
    return filterItems(items, q)
      .sort((a, b) => Number(inTitle(b)) - Number(inTitle(a)) || byRecent(a, b))
      .slice(0, MAX_RESULTS);
  }, [items, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const move = (delta: number) =>
    setActive((i) =>
      results.length === 0 ? 0 : (i + delta + results.length) % results.length,
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
      const hit = results[active];
      if (hit) onOpen(hit.id);
    }
  };

  const activeItem = results[active];

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
            activeItem ? `search-palette-${activeItem.id}` : undefined
          }
          aria-label="Search notes and code"
          placeholder="Search notes and code"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="search-palette__close"
          onClick={onClose}
          aria-label="Close search"
          title="Close (Esc)"
        >
          <XIcon size={16} />
        </button>
      </div>

      {results.length === 0 ? (
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
          {results.map((item, i) => (
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
                {isCodeItem(item) ? (
                  <CodeIcon size={16} />
                ) : (
                  <NoteIcon size={16} />
                )}
              </span>
              <span className="search-palette__title">
                {item.title || "untitled"}
              </span>
              <span className="search-palette__path">
                {getFolderPath(folders, item.folderId).join(" / ")}
              </span>
              <span className="search-palette__date">
                {formatDate(item.updatedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default SearchPalette;
