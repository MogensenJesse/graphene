// src/components/note/CopyNoteButton.tsx
import { useClipboard } from "../../hooks/useClipboard";
import Button from "../ui/Button";
import { CheckIcon, CopyIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

interface CopyNoteButtonProps {
  // The note's markdown, copied as it is (no title)
  text: string;
}

// Icon-only copy for the whole note, in the item header's action row
function CopyNoteButton({ text }: CopyNoteButtonProps) {
  const { copy, copied } = useClipboard();

  return (
    <Tooltip label={copied ? "Copied" : "Copy note"}>
      <Button
        size="sm"
        iconOnly
        className={copied ? "item-header__copied" : undefined}
        onClick={() => copy(text)}
        disabled={!text}
        aria-label="Copy note"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </Tooltip>
  );
}

export default CopyNoteButton;
