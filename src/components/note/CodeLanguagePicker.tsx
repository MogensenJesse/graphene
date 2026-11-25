// src/components/note/CodeLanguagePicker.tsx
import { useEffect, useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useEscape } from "../../hooks/useEscape";
import { ChevronDownIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

// Quick picks. Any other tag can be typed; highlighting knows most mainstream languages.
const LANGUAGES = [
  "js",
  "ts",
  "css",
  "scss",
  "html",
  "bash",
  "json",
  "python",
  "sql",
  "yaml",
  "markdown",
];

interface Option {
  label: string;
  value: string; // "" = no tag (plain)
}

// "plain" first: a block with no tag opens the list at the top, on it, instead of at the far end
const OPTIONS: Option[] = [
  { label: "plain", value: "" },
  ...LANGUAGES.map((l) => ({ label: l, value: l })),
];

interface CodeLanguagePickerProps {
  lang: string; // current tag of the block the caret is in, "" when untagged
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (lang: string) => void;
}

function CodeLanguagePicker({
  lang,
  open,
  onOpenChange,
  onPick,
}: CodeLanguagePickerProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // A tag has no spaces or backticks; lower case matches how the highlighter looks languages up
  const typed = query
    .trim()
    .toLowerCase()
    .replace(/[\s`]+/g, "");
  const options = OPTIONS.filter((o) => o.label.includes(typed));
  // Anything not in the list is still a valid tag, reachable as the last row
  if (typed && !options.some((o) => o.value === typed)) {
    options.push({ label: `use "${typed}"`, value: typed });
  }

  // Fresh query each time it opens, with the current language preselected
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open only; `lang` is read once at that moment
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(
      Math.max(
        0,
        OPTIONS.findIndex((o) => o.value === lang),
      ),
    );
    inputRef.current?.focus();
  }, [open]);

  // Also when it opens: the dropdown is made again each time, so an unchanged index still needs its row brought into view
  // biome-ignore lint/correctness/useExhaustiveDependencies: `open` only re-runs it when the list is drawn again
  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index, open]);

  useClickOutside(wrapRef, open, () => onOpenChange(false));

  useEscape(() => onOpenChange(false), { active: open, capture: true });

  const pick = (value: string) => {
    onOpenChange(false);
    onPick(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const choice = options[index];
      if (choice) pick(choice.value);
    }
  };

  return (
    <div className="code-language" ref={wrapRef}>
      <Tooltip label="Code block language" keys="Ctrl+L">
        <button
          type="button"
          className={`code-language__chip${open ? " code-language__chip--open" : ""}`}
          onClick={() => onOpenChange(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {lang || "plain"}
          <span className="code-language__chevron" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>
      </Tooltip>

      {open && (
        <div className="code-language__dropdown">
          <input
            ref={inputRef}
            className="code-language__input"
            type="text"
            placeholder="Language…"
            aria-label="Code block language"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="code-language__list" role="menu" ref={listRef}>
            {options.map((o, i) => (
              <button
                key={o.label}
                type="button"
                role="menuitem"
                className={`code-language__option${i === index ? " code-language__option--active" : ""}${o.value === lang ? " code-language__option--current" : ""}`}
                onClick={() => pick(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeLanguagePicker;
