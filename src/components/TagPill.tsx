// src/components/TagPill.tsx
import { TAG_COLORS } from "../types";

interface TagPillProps {
  tag: string;
  small?: boolean;
}

function TagPill({ tag, small = false }: TagPillProps) {
  const fallback = {
    bg: "var(--color-background-secondary)",
    color: "var(--color-text-secondary)",
  };
  const colours = TAG_COLORS[tag.toLowerCase()] ?? fallback;

  return (
    <span
      className={`tag-pill${small ? " tag-pill--small" : ""}`}
      style={{ background: colours.bg, color: colours.color }}
    >
      {tag}
    </span>
  );
}

export default TagPill;
