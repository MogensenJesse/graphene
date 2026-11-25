// src/components/ui/InlineInput.tsx
import { useEffect, useId, useRef, useState } from "react";

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
  /**
   * Why the trimmed text cannot be used, or null. On a message Enter commits nothing: the field stays open
   * and shows it. Leaving the field with such a text cancels, so the old name comes back.
   */
  validate?: (value: string) => string | null;
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
  validate,
}: InlineInputProps) {
  const [value, setValue] = useState(initial);
  // Shown after an Enter that was refused, until the text changes into something that passes
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter commits and then the unmounting input may blur: report only once
  const done = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (how: "enter" | "blur" | "escape") => {
    if (done.current) return;
    const text = value.trim();
    const problem =
      how !== "escape" && text ? (validate?.(text) ?? null) : null;
    if (problem && how === "enter") {
      setError(problem);
      return;
    }
    done.current = true;
    if (how !== "escape" && text && !problem) onCommit(text);
    else onCancel();
  };

  const input = (
    <input
      ref={inputRef}
      className={className}
      type="text"
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onInput?.(e.target.value);
        const text = e.target.value.trim();
        if (error) setError(text ? (validate?.(text) ?? null) : null);
      }}
      onBlur={() => finish("blur")}
      onKeyDown={(e) => {
        if (isolate) e.stopPropagation();
        if (e.key === "Enter") finish("enter");
        if (e.key === "Escape") {
          // The editor's own Escape handler must not also close the editor
          e.stopPropagation();
          finish("escape");
        }
      }}
    />
  );

  // Only a field that validates gets the wrapper that carries the message; the others stay a bare input
  if (!validate) return input;
  return (
    <span className="inline-input">
      {input}
      {error && (
        <span id={errorId} role="alert" className="inline-input__error">
          {error}
        </span>
      )}
    </span>
  );
}

export default InlineInput;
