// src/components/note/CodeBlock.tsx
import { type ReactNode, useRef } from "react";
import { CheckIcon, CopyIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

interface CodeBlockProps {
  children: ReactNode;
  // The fence's language tag; nothing is shown for an untagged block
  lang?: string;
  copied: boolean;
  // Receives the rendered text; callers that already hold the exact source may ignore it
  onCopy: (text: string) => void;
}

function CodeBlock({ children, lang, copied, onCopy }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);

  return (
    <div className="code-block">
      <pre ref={preRef}>{children}</pre>
      <div className="code-block__bar">
        {lang && <span className="code-block__lang">{lang}</span>}
        <Tooltip label={copied ? "Copied" : "Copy code"}>
          <button
            type="button"
            className={`code-block__copy${copied ? " code-block__copy--copied" : ""}`}
            onClick={() => onCopy(preRef.current?.textContent ?? "")}
            aria-label="Copy code"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export default CodeBlock;
