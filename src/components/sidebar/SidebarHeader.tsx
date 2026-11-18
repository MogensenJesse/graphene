// src/components/sidebar/SidebarHeader.tsx
import type { UpdateStatus } from "../../hooks/useUpdater";
import { HexagonIcon } from "../ui/Icon";

// What the version button says while an update check is in flight or has just finished
const VERSION_LABEL: Partial<Record<UpdateStatus, string>> = {
  checking: "checking…",
  "up-to-date": "up to date",
  error: "check failed",
};

interface SidebarHeaderProps {
  version: string;
  updateStatus: UpdateStatus;
  updateAvailable: boolean;
  onCheckUpdates: () => void;
  onShowUpdate: () => void;
}

// Brand, "Update" pill and version button; the strip also drags the window
function SidebarHeader({
  version,
  updateStatus,
  updateAvailable,
  onCheckUpdates,
  onShowUpdate,
}: SidebarHeaderProps) {
  return (
    <div className="sidebar__header" data-tauri-drag-region>
      <div className="sidebar__brand" data-tauri-drag-region>
        <HexagonIcon size={14} />
        <span>Graphene</span>
      </div>
      <div className="sidebar__version-wrap">
        {updateAvailable && (
          <button
            type="button"
            className="sidebar__update-pill"
            onClick={onShowUpdate}
            title="A new version is available"
          >
            Update
          </button>
        )}
        {version && (
          <button
            type="button"
            className="sidebar__version"
            onClick={onCheckUpdates}
            disabled={
              updateStatus === "checking" || updateStatus === "installing"
            }
            title="Check for updates"
          >
            {VERSION_LABEL[updateStatus] ?? `v${version}`}
          </button>
        )}
      </div>
    </div>
  );
}

export default SidebarHeader;
