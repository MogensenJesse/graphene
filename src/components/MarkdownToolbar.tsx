// src/components/MarkdownToolbar.tsx
import { Fragment } from "react";
import type { FormatType } from "../hooks/useMarkdownFormat";

interface MarkdownToolbarProps {
  onFormat: (type: FormatType) => void;
}

const GROUPS: { type: FormatType; label: string }[][] = [
  [
    { type: "h1", label: "H1" },
    { type: "h2", label: "H2" },
    { type: "h3", label: "H3" },
  ],
  [
    { type: "bold", label: "B" },
    { type: "italic", label: "I" },
    { type: "strikethrough", label: "S" },
  ],
  [
    { type: "ul", label: "\u2022" },
    { type: "ol", label: "1." },
    { type: "blockquote", label: "\u201C" },
  ],
  [
    { type: "code", label: "`" },
    { type: "codeblock", label: "\u2039\u203A" },
  ],
  [
    { type: "link", label: "[ ]" },
    { type: "hr", label: "\u2014" },
  ],
];

function MarkdownToolbar({ onFormat }: MarkdownToolbarProps) {
  return (
    <div className="markdown-toolbar">
      {GROUPS.map((group, gi) => (
        <Fragment key={group[0].type}>
          {gi > 0 && (
            <span className="markdown-toolbar__sep" aria-hidden="true" />
          )}
          {group.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className="markdown-toolbar__btn"
              onClick={() => onFormat(type)}
              aria-label={type}
            >
              {label}
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

export default MarkdownToolbar;
