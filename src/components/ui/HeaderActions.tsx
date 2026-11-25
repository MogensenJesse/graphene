// src/components/ui/HeaderActions.tsx
import { memo } from "react";
import type { ItemKind } from "../../types";
import type { OpenSettings } from "../dialogs/SettingsDialog";
import { GearIcon, PlusIcon, SearchIcon } from "./Icon";
import IconButton from "./IconButton";
import { NEW_KINDS } from "./newKinds";
import Tooltip from "./Tooltip";

interface HeaderActionsProps {
  /** The Tasks tab starts a task where the Notes tab starts a note */
  inTasks: boolean;
  /** The vault cannot be opened: nothing can be started in it */
  newDisabled: boolean;
  onSearch: () => void;
  onNew: (kind: ItemKind) => void;
  onSettings: OpenSettings;
}

/**
 * Search, New and Settings as icon buttons beside the sidebar toggle. The App shows them while the sidebar is hidden, when its own
 * Search, New and Settings are out of sight; the shortcuts are the same ones.
 */
function HeaderActions({
  inTasks,
  newDisabled,
  onSearch,
  onNew,
  onSettings,
}: HeaderActionsProps) {
  const newLabel = inTasks ? "New task" : "New note";
  const NewIcon = inTasks ? PlusIcon : NEW_KINDS[0].Icon;
  return (
    <div className="app__quick">
      <Tooltip label="Search" keys="Ctrl+K">
        <IconButton aria-label="Search" onClick={onSearch}>
          <SearchIcon size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip label={newLabel} keys="Ctrl+N">
        <IconButton
          aria-label={newLabel}
          disabled={newDisabled}
          onClick={() => onNew("note")}
        >
          <NewIcon size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Settings" keys="Ctrl+,">
        <IconButton
          className="app__quick-settings"
          aria-label="Settings"
          onClick={() => onSettings()}
        >
          <GearIcon size={16} />
        </IconButton>
      </Tooltip>
    </div>
  );
}

export default memo(HeaderActions);
