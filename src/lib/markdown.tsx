// src/lib/markdown.tsx
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import CodeBlock from "../components/CodeBlock";
import { useClipboard } from "../hooks/useClipboard";

// No `as const` — it makes the array readonly and triggers TS4104 on remarkPlugins
export const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

// Fenced code in notes gets the same copy button as snippets
function MarkdownPre({ children }: { children?: ReactNode }) {
  const { copy, copied } = useClipboard();
  return (
    <CodeBlock copied={copied} onCopy={(text) => copy(text.replace(/\n$/, ""))}>
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
