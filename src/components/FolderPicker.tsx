// src/components/FolderPicker.tsx
import { useMemo, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import type { Folder } from "../types";

interface FlatFolder {
  folder: Folder;
  depth: number;
}

function flattenFolders(
  folders: Folder[],
  parentId: string | null = null,
  depth = 0,
): FlatFolder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .flatMap((f) => [
      { folder: f, depth },
      ...flattenFolders(folders, f.id, depth + 1),
    ]);
}

interface FolderPickerProps {
  folders: Folder[];
  value: string | null;
  onChange: (id: string | null) => void;
}

function FolderPicker({ folders, value, onChange }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => flattenFolders(folders), [folders]);
  const selectedName = useMemo(
    () => folders.find((f) => f.id === value)?.name ?? "no folder",
    [folders, value],
  );

  useClickOutside(wrapRef, open, () => setOpen(false));

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
        <span className="folder-picker__chevron" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="folder-picker__dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className={`folder-picker__option${value === null ? " folder-picker__option--selected" : ""}`}
            onClick={() => handleSelect(null)}
          >
            <span className="folder-picker__option-icon" aria-hidden="true">◈</span>
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
                📁
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
