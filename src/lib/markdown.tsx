// src/lib/markdown.tsx
import { isValidElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import CodeBlock from "../components/note/CodeBlock";
import { useClipboard } from "../hooks/useClipboard";
import { openLink } from "./openLink";
import rehypeCodeLines from "./rehypeCodeLines";

// No `as const` — it makes the array readonly and triggers TS4104 on remarkPlugins
export const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

// Colours fenced code by its language tag (```js), untagged or unknown tags stay plain, then puts each line in a span for
// the line numbers (rehypeCodeLines).
export const REHYPE_PLUGINS = [rehypeHighlight, rehypeCodeLines];

// The <code> inside <pre> carries the fence's language as the class "language-js"
function languageOf(children: ReactNode): string {
  if (!isValidElement<{ className?: string }>(children)) return "";
  return /language-(\S+)/.exec(children.props.className ?? "")?.[1] ?? "";
}

// Fenced code in notes gets a copy button and a language label
function MarkdownPre({ children }: { children?: ReactNode }) {
  const { copy, copied } = useClipboard();
  return (
    <CodeBlock
      lang={languageOf(children)}
      copied={copied}
      onCopy={(text) => copy(text.replace(/\n$/, ""))}
    >
      {children}
    </CodeBlock>
  );
}

export const MARKDOWN_COMPONENTS: Components = {
  pre: ({ children }) => <MarkdownPre>{children}</MarkdownPre>,
  // A table wider than the column scrolls sideways inside its own box instead of crushing the cells (see _NoteDetail)
  table: ({ children }) => (
    <div className="md-table">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      title={href}
      onClick={(e) => {
        // Never let a link navigate the app window; hand it to the default browser
        e.preventDefault();
        openLink(href);
      }}
    >
      {children}
    </a>
  ),
};
