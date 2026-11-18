// src/components/note/FolderPicker.tsx
import { useMemo, useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useEscape } from "../../hooks/useEscape";
import { compareFoldersManual } from "../../lib/order";
import { flattenFolders, getFolderPath } from "../../lib/utils";
import type { Folder } from "../../types";
import { ChevronDownIcon, FolderIcon, NoFolderIcon } from "../ui/Icon";

interface FolderPickerProps {
  folders: Folder[];
  value: string | null;
  onChange: (id: string | null) => void;
}

function FolderPicker({ folders, value, onChange }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(
    () => flattenFolders(folders, compareFoldersManual),
    [folders],
  );
  // Full path ("Notes › Prompts") so nested folders are unambiguous
  const selectedName = useMemo(
    () => getFolderPath(folders, value).join(" › ") || "no folder",
    [folders, value],
  );

  useClickOutside(wrapRef, open, () => setOpen(false));

  useEscape(() => setOpen(false), { active: open, capture: true });

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
