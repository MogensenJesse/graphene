// src/components/ui/NewFab.tsx
import { PlusIcon } from "./Icon";

interface NewFabProps {
  label: string;
  onClick: () => void;
}

/** The round "+" over the bottom right corner of a phone's list: the one thing it starts. */
function NewFab({ label, onClick }: NewFabProps) {
  return (
    <button
      type="button"
      className="new-fab"
      aria-label={label}
      onClick={onClick}
    >
      <PlusIcon size={22} />
    </button>
  );
}

export default NewFab;
