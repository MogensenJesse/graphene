// src/components/sidebar/PhoneActions.tsx
import type { OpenSettings } from "../dialogs/SettingsDialog";
import { GearIcon, TrashIcon } from "../ui/Icon";
import IconButton from "../ui/IconButton";
import type { SidebarTab } from "./Sidebar";
import { trashLabel } from "./trashLabel";

interface PhoneActionsProps {
  tab: SidebarTab;
  trashOpen: boolean;
  trashedCount: number;
  /** The vault cannot be opened: there is no trash to open or to count */
  unavailable: boolean;
  onOpenTrash: () => void;
  onOpenSettings: OpenSettings;
}

/**
 * Trash and Settings on a phone's list screen: at the end of its header, since the bottom of the screen is the "+" and the Notes | Tasks
 * bar. (A computer has them in the sidebar's footer.) Only notes have a Trash.
 */
function PhoneActions({
  tab,
  trashOpen,
  trashedCount,
  unavailable,
  onOpenTrash,
  onOpenSettings,
}: PhoneActionsProps) {
  return (
    <>
      {tab === "notes" && (
        <button
          type="button"
          className={`sidebar__trash${trashOpen ? " sidebar__trash--active" : ""}`}
          aria-label={trashLabel(unavailable, trashedCount)}
          disabled={unavailable}
          onClick={onOpenTrash}
        >
          <TrashIcon size={16} />
          {!unavailable && trashedCount > 0 && (
            <span className="sidebar__trash-count">{trashedCount}</span>
          )}
        </button>
      )}
      <IconButton
        size="lg"
        aria-label="Settings"
        onClick={() => onOpenSettings()}
      >
        <GearIcon size={16} />
      </IconButton>
    </>
  );
}

export default PhoneActions;
