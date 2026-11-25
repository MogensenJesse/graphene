// src/components/ui/SidebarToggle.tsx

import { PanelLeftIcon } from "./Icon";
import IconButton from "./IconButton";
import Tooltip from "./Tooltip";

interface SidebarToggleProps {
  hidden: boolean;
  onToggle: () => void;
}

/** Shows or hides the sidebar. It sits in the top-left corner of the main panel (so it moves with the sidebar), which is there either way. */
function SidebarToggle({ hidden, onToggle }: SidebarToggleProps) {
  return (
    <Tooltip label={hidden ? "Show sidebar" : "Hide sidebar"}>
      <IconButton
        className="app__sidebar-toggle"
        onClick={onToggle}
        aria-label="Sidebar"
        aria-expanded={!hidden}
      >
        <PanelLeftIcon size={16} />
      </IconButton>
    </Tooltip>
  );
}

export default SidebarToggle;
