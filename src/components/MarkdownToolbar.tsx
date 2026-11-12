// src/components/MarkdownToolbar.tsx
import { Fragment, type ReactNode } from "react";
import type { FormatType } from "../hooks/useMarkdownFormat";

interface MarkdownToolbarProps {
  onFormat: (type: FormatType) => void;
  // Shown at the right end of the toolbar (the code block language chip)
  children?: ReactNode;
}

const GROUPS: { type: FormatType; label: string; title: string }[][] = [
  [
    { type: "h1", label: "H1", title: "Heading 1" },
    { type: "h2", label: "H2", title: "Heading 2" },
    { type: "h3", label: "H3", title: "Heading 3" },
  ],
  [
    { type: "bold", label: "B", title: "Bold (Ctrl+B)" },
    { type: "italic", label: "I", title: "Italic (Ctrl+I)" },
    { type: "strikethrough", label: "S", title: "Strikethrough" },
  ],
  [
    { type: "ul", label: "\u2022", title: "Bulleted list" },
    { type: "ol", label: "1.", title: "Numbered list" },
    { type: "blockquote", label: "\u201C", title: "Quote" },
  ],
  [
    { type: "code", label: "`", title: "Inline code" },
    { type: "codeblock", label: "\u2039\u203A", title: "Code block" },
  ],
  [
    { type: "link", label: "link", title: "Link" },
    { type: "hr", label: "\u2014", title: "Divider" },
  ],
];

function MarkdownToolbar({ onFormat, children }: MarkdownToolbarProps) {
  return (
    <div className="markdown-toolbar">
      {GROUPS.map((group, gi) => (
        <Fragment key={group[0].type}>
          {gi > 0 && (
            <span className="markdown-toolbar__sep" aria-hidden="true" />
          )}
          {group.map(({ type, label, title }) => (
            <button
              key={type}
              type="button"
              className="markdown-toolbar__btn"
              onClick={() => onFormat(type)}
              aria-label={title}
              title={title}
            >
              {label}
            </button>
          ))}
        </Fragment>
      ))}
      {children && <div className="markdown-toolbar__trailing">{children}</div>}
    </div>
  );
}

export default MarkdownToolbar;
