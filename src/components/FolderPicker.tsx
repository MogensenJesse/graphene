// src/components/FolderPicker.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { flattenFolders, getFolderPath } from "../lib/utils";
import type { Folder } from "../types";
import { ChevronDownIcon, FolderIcon, NoFolderIcon } from "./Icon";

interface FolderPickerProps {
  folders: Folder[];
  value: string | null;
  onChange: (id: string | null) => void;
}

function FolderPicker({ folders, value, onChange }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => flattenFolders(folders), [folders]);
  // Full path ("Notes › Prompts") so nested folders are unambiguous
  const selectedName = useMemo(
    () => getFolderPath(folders, value).join(" › ") || "no folder",
    [folders, value],
  );

  useClickOutside(wrapRef, open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    // Capture phase: runs before the editor's Escape handler, which would otherwise close the editor
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const handleSelect = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="folder-picker" ref={wrapRef}>
      <button
        type="button"
        className={`folder-picker__trigger${open ? " folder-picker__trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="folder-picker__label">{selectedName}</span>
        <span className="folder-picker__chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div className="folder-picker__dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className={`folder-picker__option${value === null ? " folder-picker__option--selected" : ""}`}
            onClick={() => handleSelect(null)}
          >
            <span className="folder-picker__option-icon" aria-hidden="true">
              <NoFolderIcon />
            </span>
            no folder
          </button>

          {flat.map(({ folder, depth }) => (
            <button
              key={folder.id}
              type="button"
              role="menuitem"
              className={`folder-picker__option${value === folder.id ? " folder-picker__option--selected" : ""}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              onClick={() => handleSelect(folder.id)}
            >
              <span className="folder-picker__option-icon" aria-hidden="true">
                <FolderIcon />
              </span>
              {folder.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FolderPicker;
