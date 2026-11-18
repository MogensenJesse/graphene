// src/components/sidebar/SidebarHeader.tsx
import type { UpdateStatus } from "../../hooks/useUpdater";
import { HexagonIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";
import ThemeButton from "./ThemeButton";

// What the version button says while an update check is in flight or has just finished
const VERSION_LABEL: Partial<Record<UpdateStatus, string>> = {
  checking: "Checking…",
  "up-to-date": "Up to date",
  error: "Check failed",
};

interface SidebarHeaderProps {
  version: string;
  updateStatus: UpdateStatus;
  updateAvailable: boolean;
  onCheckUpdates: () => void;
  onShowUpdate: () => void;
}

// Brand, "Update" pill, version button and theme button (everything about the app itself); the strip also drags the window
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
          <Tooltip label="A new version is available">
            <button
              type="button"
              className="sidebar__update-pill"
              onClick={onShowUpdate}
            >
              Update
            </button>
          </Tooltip>
        )}
        {version && (
          <Tooltip label="Check for updates">
            <button
              type="button"
              className="sidebar__version"
              onClick={onCheckUpdates}
              disabled={
                updateStatus === "checking" || updateStatus === "installing"
              }
            >
              {VERSION_LABEL[updateStatus] ?? `v${version}`}
            </button>
          </Tooltip>
        )}
        <ThemeButton />
      </div>
    </div>
  );
}

export default SidebarHeader;
