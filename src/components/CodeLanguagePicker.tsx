// src/components/CodeLanguagePicker.tsx
import { useEffect, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { ChevronDownIcon } from "./Icon";

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

const OPTIONS: Option[] = [
  ...LANGUAGES.map((l) => ({ label: l, value: l })),
  { label: "plain", value: "" },
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

  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useClickOutside(wrapRef, open, () => onOpenChange(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    // Capture phase: runs before the editor's Escape handler, which would otherwise close the editor
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

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
      <button
        type="button"
        className={`code-language__chip${open ? " code-language__chip--open" : ""}`}
        onClick={() => onOpenChange(!open)}
        title="Code block language (Ctrl+L)"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {lang || "plain"}
        <span className="code-language__chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div className="code-language__dropdown">
          <input
            ref={inputRef}
            className="code-language__input"
            type="text"
            placeholder="language…"
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
