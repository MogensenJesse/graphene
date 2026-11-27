// src/components/sidebar/SidebarHeader.tsx
import { memo } from "react";
import type { Vaults } from "../../hooks/useVaults";
import { perfRender } from "../../lib/perf";
import type { OpenSettings } from "../dialogs/SettingsDialog";
import { HexagonIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";
import PhoneActions from "./PhoneActions";
import type { SidebarTab } from "./Sidebar";
import VaultSwitcher from "./VaultSwitcher";

interface SidebarHeaderProps {
  updateAvailable: boolean;
  vaults: Vaults;
  onShowUpdate: () => void;
  onOpenSettings: OpenSettings;
  /** A phone: Trash and Settings are here, not in the footer */
  phone: boolean;
  tab: SidebarTab;
  trashOpen: boolean;
  trashedCount: number;
  unavailable: boolean;
  onOpenTrash: () => void;
}

// Brand on the left; on the right the "Update" pill (only while a new version exists) and the vault switcher (and, on a phone,
// Trash and Settings). The version number and the update check live in Settings > About. The strip also drags the window.
function SidebarHeader({
  updateAvailable,
  vaults,
  onShowUpdate,
  onOpenSettings,
  phone,
  tab,
  trashOpen,
  trashedCount,
  unavailable,
  onOpenTrash,
}: SidebarHeaderProps) {
  perfRender("SidebarHeader");
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
        {phone && (
          <PhoneActions
            tab={tab}
            trashOpen={trashOpen}
            trashedCount={trashedCount}
            unavailable={unavailable}
            onOpenTrash={onOpenTrash}
            onOpenSettings={onOpenSettings}
          />
        )}
      </div>
    </div>
  );
}

export default memo(SidebarHeader);
