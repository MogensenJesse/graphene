// src/components/Icon.tsx
import type { ReactNode } from "react";

// One icon family: 12x12 stroke icons that follow the surrounding text colour
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function NoteIcon() {
  return (
    <Svg>
      <path d="M3 1.5h3.8l2.7 2.7V10a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" />
      <path d="M6.8 1.5v2.7h2.7" />
    </Svg>
  );
}

export function FolderIcon() {
  return (
    <Svg>
      <path d="M1.5 3a.5.5 0 0 1 .5-.5h2.6l1 1.2H10a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-.5.5H2A.5.5 0 0 1 1.5 9V3Z" />
    </Svg>
  );
}

export function FolderOpenIcon() {
  return (
    <Svg>
      <path d="M1.5 9.5V3a.5.5 0 0 1 .5-.5h2.6l1 1.2H9a.5.5 0 0 1 .5.5V5" />
      <path d="M1.5 9.5l1.2-3.8a.5.5 0 0 1 .5-.4h7.6a.5.5 0 0 1 .5.7L10 9.2a.5.5 0 0 1-.5.3h-8Z" />
    </Svg>
  );
}

export function EditIcon() {
  return (
    <Svg>
      <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" />
    </Svg>
  );
}

export function TrashIcon() {
  return (
    <Svg>
      <path d="M2 3h8M5 3V2h2v1M9.5 3l-.5 7a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5L3 3" />
    </Svg>
  );
}
