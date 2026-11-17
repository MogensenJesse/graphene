// src/components/FindBar.tsx
import { useEffect, useRef } from "react";
import type { Finder } from "../hooks/useFind";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "./Icon";

interface FindBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  finder: Finder;
  onClose: () => void;
  // Changes each time Ctrl+F is pressed, so the box takes focus again
  focusKey: number;
}

// The small find box over the top right of a note (read view and editor)
function FindBar({
  query,
  onQueryChange,
  finder,
  onClose,
  focusKey,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focusKey is the trigger
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusKey]);

  return (
    <search className="find-bar">
      <input
        ref={inputRef}
        className="find-bar__input"
        type="text"
        aria-label="Find in note"
        placeholder="Find in note"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) finder.prev();
            else finder.next();
          } else if (e.key === "Escape") {
            // Keep the editor's own Escape handler from also closing the whole editor
            e.stopPropagation();
            onClose();
          }
        }}
      />
      <span className="find-bar__count" aria-live="polite">
        {query ? `${finder.count ? finder.index + 1 : 0}/${finder.count}` : ""}
      </span>
      <button
        type="button"
        className="find-bar__btn"
        onClick={finder.prev}
        disabled={finder.count === 0}
        aria-label="Previous match"
        title="Previous (Shift+Enter)"
      >
        <ChevronUpIcon size={14} />
      </button>
      <button
        type="button"
        className="find-bar__btn"
        onClick={finder.next}
        disabled={finder.count === 0}
        aria-label="Next match"
        title="Next (Enter)"
      >
        <ChevronDownIcon size={14} />
      </button>
      <button
        type="button"
        className="find-bar__btn"
        onClick={onClose}
        aria-label="Close find"
        title="Close (Esc)"
      >
        <XIcon size={14} />
      </button>
    </search>
  );
}

export default FindBar;
