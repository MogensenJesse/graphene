// src/lib/markdown.tsx
import { openUrl } from "@tauri-apps/plugin-opener";
import { isValidElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import CodeBlock from "../components/CodeBlock";
import { useClipboard } from "../hooks/useClipboard";

// No `as const` — it makes the array readonly and triggers TS4104 on remarkPlugins
export const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

// Colours fenced code by its language tag (```js). Untagged or unknown tags stay plain.
export const REHYPE_PLUGINS = [rehypeHighlight];

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
  a: ({ href, children }) => (
    <a
      href={href}
      title={href}
      onClick={(e) => {
        // Never let a link navigate the app window; hand it to the default browser
        e.preventDefault();
        if (href && /^(https?:|mailto:)/i.test(href)) {
          openUrl(href).catch(console.error);
        }
      }}
    >
      {children}
    </a>
  ),
};
