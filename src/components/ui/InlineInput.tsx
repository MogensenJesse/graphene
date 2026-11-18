// src/components/ui/InlineInput.tsx
import { useEffect, useRef, useState } from "react";

interface InlineInputProps {
  initial?: string;
  className: string;
  placeholder?: string;
  ariaLabel?: string;
  /** Enter, or the input losing focus: the trimmed text, never empty. */
  onCommit: (value: string) => void;
  /** Escape, or nothing typed. */
  onCancel: () => void;
  /** Every change as it is typed, for a title that updates live. */
  onInput?: (value: string) => void;
  /** Keep every key from reaching the parents (a row that selects on Enter and Space). */
  isolate?: boolean;
}

/**
 * A text box that appears in place of a name to edit it: it takes the focus with its text selected,
 * Enter or a click elsewhere commits, Escape cancels.
 */
function InlineInput({
  initial = "",
  className,
  placeholder,
  ariaLabel,
  onCommit,
  onCancel,
  onInput,
  isolate = false,
}: InlineInputProps) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter commits and then the unmounting input may blur: report only once
  const done = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (apply: boolean) => {
    if (done.current) return;
    done.current = true;
    const text = value.trim();
    if (apply && text) onCommit(text);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      className={className}
      type="text"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onInput?.(e.target.value);
      }}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (isolate) e.stopPropagation();
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") {
          // The editor's own Escape handler must not also close the editor
          e.stopPropagation();
          finish(false);
        }
      }}
    />
  );
}

export default InlineInput;
