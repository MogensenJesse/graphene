// src/components/CopyNoteButton.tsx
import { useClipboard } from "../hooks/useClipboard";
import { CheckIcon, CopyIcon } from "./Icon";

interface CopyNoteButtonProps {
  // The note's markdown, copied as it is (no title)
  text: string;
}

// Icon-only copy for the whole note, in the item header's action row
function CopyNoteButton({ text }: CopyNoteButtonProps) {
  const { copy, copied } = useClipboard();

  return (
    <button
      type="button"
      className={`item-header__btn item-header__btn--icon${copied ? " item-header__btn--copied" : ""}`}
      onClick={() => copy(text)}
      disabled={!text}
      title={copied ? "Copied" : "Copy note"}
      aria-label="Copy note"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

export default CopyNoteButton;
