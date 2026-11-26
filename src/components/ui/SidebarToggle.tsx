// src/components/ui/SidebarToggle.tsx

import { ChevronLeftIcon, PanelLeftIcon } from "./Icon";
import IconButton from "./IconButton";
import Tooltip from "./Tooltip";

interface SidebarToggleProps {
  hidden: boolean;
  /** A phone: the list is a screen, and this is the way back to it */
  back?: boolean;
  onToggle: () => void;
}

/** Shows or hides the sidebar. It sits in the top-left corner of the main panel (so it moves with the sidebar), which is there either way. */
function SidebarToggle({ hidden, back = false, onToggle }: SidebarToggleProps) {
  return (
    <Tooltip label={hidden ? "Show sidebar" : "Hide sidebar"}>
      <IconButton
        className="app__sidebar-toggle"
        onClick={onToggle}
        aria-label={back ? "Back to the list" : "Sidebar"}
        aria-expanded={back ? undefined : !hidden}
      >
        {back ? <ChevronLeftIcon size={18} /> : <PanelLeftIcon size={16} />}
      </IconButton>
    </Tooltip>
  );
}

export default SidebarToggle;
