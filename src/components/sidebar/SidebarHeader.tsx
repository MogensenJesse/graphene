// src/components/sidebar/SidebarHeader.tsx
import type { Vaults } from "../../hooks/useVaults";
import type { OpenSettings } from "../dialogs/SettingsDialog";
import { HexagonIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";
import VaultSwitcher from "./VaultSwitcher";

interface SidebarHeaderProps {
  updateAvailable: boolean;
  vaults: Vaults;
  onShowUpdate: () => void;
  onOpenSettings: OpenSettings;
}

// Brand on the left; on the right the "Update" pill (only while a new version exists) and the vault switcher.
// The version number and the update check live in Settings > About. The strip also drags the window.
function SidebarHeader({
  updateAvailable,
  vaults,
  onShowUpdate,
  onOpenSettings,
}: SidebarHeaderProps) {
  return (
    <div className="sidebar__header" data-tauri-drag-region>
      <div className="sidebar__brand" data-tauri-drag-region>
        <HexagonIcon size={14} />
        <span>Graphene</span>
      </div>
      <div className="sidebar__header-end">
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
        <VaultSwitcher vaults={vaults} onOpenSettings={onOpenSettings} />
      </div>
    </div>
  );
}

export default SidebarHeader;
