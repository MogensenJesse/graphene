// src/components/CodeBlock.tsx
import { type ReactNode, useRef } from "react";

interface CodeBlockProps {
  children: ReactNode;
  copied: boolean;
  // Receives the rendered text; callers that already hold the exact source may ignore it
  onCopy: (text: string) => void;
}

function CodeBlock({ children, copied, onCopy }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);

  return (
    <div className="code-block">
      <pre ref={preRef}>{children}</pre>
      <button
        type="button"
        className={`code-block__copy${copied ? " code-block__copy--copied" : ""}`}
        onClick={() => onCopy(preRef.current?.innerText ?? "")}
        aria-label="Copy code"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

export default CodeBlock;
