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
  IndentIcon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  OutdentIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  UndoIcon,
} from "../ui/Icon";
import IconButton from "../ui/IconButton";
import Tooltip from "../ui/Tooltip";

export type HistoryCommand = "undo" | "redo";

interface MarkdownToolbarProps {
  onFormat: (type: FormatType) => void;
  // Undo and redo, for a screen with no Ctrl+Z
  onHistory: (command: HistoryCommand) => void;
  // The formats that are on where the caret is; their buttons light up
  active?: ReadonlySet<FormatType>;
  // Inside a code block markdown means nothing, so the formats are off; the children (language chip) stay usable
  disabled?: boolean;
  // Shown at the right end of the toolbar (the code block language chip)
  children?: ReactNode;
}

interface FormatButton {
  type: FormatType;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  keys?: string; // shortcut, for the tooltip
  hint: string; // what it writes, for the tooltip
  touch?: true; // only on a touch screen (its keyboard has no Tab key), so not in the right-click menu either
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
    {
      type: "outdent",
      label: "Outdent",
      Icon: OutdentIcon,
      hint: "Tab out",
      touch: true,
    },
    {
      type: "indent",
      label: "Indent",
      Icon: IndentIcon,
      hint: "Tab",
      touch: true,
    },
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
const ONE_SHOT = new Set<FormatType>([
  "codeblock",
  "hr",
  "link",
  "indent",
  "outdent",
]);

const HISTORY: {
  command: HistoryCommand;
  label: string;
  Icon: ComponentType<{ size?: number }>;
}[] = [
  { command: "undo", label: "Undo", Icon: UndoIcon },
  { command: "redo", label: "Redo", Icon: RedoIcon },
];

/** The toolbar's formats as one "Format" submenu, for the editor's right-click menu. */
export const formatMenuEntry = (
  onFormat: (type: FormatType) => void,
): MenuEntry => ({
  label: "Format",
  submenu: GROUPS.flatMap((group, i) => [
    ...(i > 0 ? ["separator" as const] : []),
    ...group
      .filter(({ touch }) => !touch)
      .map(({ type, label, Icon, keys }) => ({
        label,
        icon: <Icon size={14} />,
        keys,
        onSelect: () => onFormat(type),
      })),
  ]),
});

function MarkdownToolbar({
  onFormat,
  onHistory,
  active,
  disabled = false,
  children,
}: MarkdownToolbarProps) {
  return (
    <div className="markdown-toolbar">
      {/* The first thing a thumb reaches for after a slip; a computer has Ctrl+Z, so it is shown on a touch screen only */}
      {HISTORY.map(({ command, label, Icon }) => (
        <IconButton
          key={command}
          variant="tool"
          className="markdown-toolbar__touch"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onHistory(command)}
          aria-label={label}
        >
          <Icon size={15} />
        </IconButton>
      ))}
      <span
        className="markdown-toolbar__sep markdown-toolbar__touch"
        aria-hidden="true"
      />
      {GROUPS.map((group, gi) => (
        <Fragment key={group[0].type}>
          {gi > 0 && (
            <span className="markdown-toolbar__sep" aria-hidden="true" />
          )}
          {group.map(({ type, label, Icon, keys, hint, touch }) => {
            const on = active?.has(type) ?? false;
            return (
              <Tooltip key={type} label={label} keys={keys} hint={hint}>
                <IconButton
                  variant="tool"
                  className={touch && "markdown-toolbar__touch"}
                  // Keep focus and the highlighted text in the editor while clicking
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => !disabled && onFormat(type)}
                  aria-label={label}
                  aria-pressed={ONE_SHOT.has(type) ? undefined : on}
                  // Not `disabled`: that would drop the button from the tab order and silence its tooltip
                  aria-disabled={disabled || undefined}
                >
                  <Icon size={15} />
                </IconButton>
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
