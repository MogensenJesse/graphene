// src/components/note/FindBar.tsx
import { useEffect, useRef } from "react";
import { useBack } from "../../hooks/useBack";
import type { Finder } from "../../hooks/useFind";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "../ui/Icon";
import IconButton from "../ui/IconButton";
import Tooltip from "../ui/Tooltip";

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
  useBack(onClose);

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
      <Tooltip label="Previous match" keys="Shift+Enter">
        <IconButton
          size="sm"
          onClick={finder.prev}
          disabled={finder.count === 0}
          aria-label="Previous match"
        >
          <ChevronUpIcon size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Next match" keys="Enter">
        <IconButton
          size="sm"
          onClick={finder.next}
          disabled={finder.count === 0}
          aria-label="Next match"
        >
          <ChevronDownIcon size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Close" keys="Esc">
        <IconButton size="sm" onClick={onClose} aria-label="Close find">
          <XIcon size={14} />
        </IconButton>
      </Tooltip>
    </search>
  );
}

export default FindBar;
