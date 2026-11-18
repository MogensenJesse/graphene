// src/components/note/MarkdownToolbar.tsx
import { type ComponentType, Fragment, type ReactNode } from "react";
import type { FormatType } from "../../lib/markdownFormat";
import type { MenuEntry } from "../ui/ContextMenu";
import {
  BoldIcon,
  CodeBlockIcon,
  DividerIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  StrikethroughIcon,
} from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

interface MarkdownToolbarProps {
  onFormat: (type: FormatType) => void;
  // The formats that are on where the caret is; their buttons light up
  active?: ReadonlySet<FormatType>;
  // Shown at the right end of the toolbar (the code block language chip)
  children?: ReactNode;
}

interface FormatButton {
  type: FormatType;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  keys?: string; // shortcut, for the tooltip
  hint: string; // what it writes, for the tooltip
}

const GROUPS: FormatButton[][] = [
  [
    { type: "h1", label: "Heading 1", Icon: Heading1Icon, hint: "# Heading" },
    { type: "h2", label: "Heading 2", Icon: Heading2Icon, hint: "## Heading" },
    { type: "h3", label: "Heading 3", Icon: Heading3Icon, hint: "### Heading" },
  ],
  [
    {
      type: "bold",
      label: "Bold",
      Icon: BoldIcon,
      keys: "Ctrl+B",
      hint: "**bold**",
    },
    {
      type: "italic",
      label: "Italic",
      Icon: ItalicIcon,
      keys: "Ctrl+I",
      hint: "*italic*",
    },
    {
      type: "strikethrough",
      label: "Strikethrough",
      Icon: StrikethroughIcon,
      hint: "~~text~~",
    },
  ],
  [
    { type: "ul", label: "Bulleted list", Icon: ListIcon, hint: "- item" },
    {
      type: "ol",
      label: "Numbered list",
      Icon: ListOrderedIcon,
      hint: "1. item",
    },
    {
      type: "task",
      label: "Task list",
      Icon: ListChecksIcon,
      hint: "- [ ] task",
    },
    { type: "blockquote", label: "Quote", Icon: QuoteIcon, hint: "> quote" },
  ],
  [
    {
      type: "code",
      label: "Inline code",
      Icon: InlineCodeIcon,
      hint: "`code`",
    },
    {
      type: "codeblock",
      label: "Code block",
      Icon: CodeBlockIcon,
      hint: "```js",
    },
  ],
  [
    { type: "link", label: "Link", Icon: LinkIcon, hint: "[text](url)" },
    { type: "hr", label: "Divider", Icon: DividerIcon, hint: "---" },
  ],
];

// Add something instead of switching on and off, so they have no pressed state
const ONE_SHOT = new Set<FormatType>(["codeblock", "hr", "link"]);

/** The toolbar's formats as one "Format" submenu, for the editor's right-click menu. */
export const formatMenuEntry = (
  onFormat: (type: FormatType) => void,
): MenuEntry => ({
  label: "Format",
  submenu: GROUPS.flatMap((group, i) => [
    ...(i > 0 ? ["separator" as const] : []),
    ...group.map(({ type, label, Icon }) => ({
      label,
      icon: <Icon size={14} />,
      onSelect: () => onFormat(type),
    })),
  ]),
});

function MarkdownToolbar({ onFormat, active, children }: MarkdownToolbarProps) {
  return (
    <div className="markdown-toolbar">
      {GROUPS.map((group, gi) => (
        <Fragment key={group[0].type}>
          {gi > 0 && (
            <span className="markdown-toolbar__sep" aria-hidden="true" />
          )}
          {group.map(({ type, label, Icon, keys, hint }) => {
            const on = active?.has(type) ?? false;
            return (
              <Tooltip key={type} label={label} keys={keys} hint={hint}>
                <button
                  type="button"
                  className={`markdown-toolbar__btn${on ? " markdown-toolbar__btn--active" : ""}`}
                  // Keep focus and the highlighted text in the editor while clicking
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onFormat(type)}
                  aria-label={label}
                  aria-pressed={ONE_SHOT.has(type) ? undefined : on}
                >
                  <Icon size={15} />
                </button>
              </Tooltip>
            );
          })}
        </Fragment>
      ))}
      {children && <div className="markdown-toolbar__trailing">{children}</div>}
    </div>
  );
}

export default MarkdownToolbar;
