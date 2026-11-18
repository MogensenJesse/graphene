// src/components/ui/SidebarToggle.tsx
import { PanelLeftIcon } from "./Icon";
import Tooltip from "./Tooltip";

interface SidebarToggleProps {
  hidden: boolean;
  onToggle: () => void;
}

/** Shows or hides the sidebar. It sits in the top-left corner of the main panel, which is there either way. */
function SidebarToggle({ hidden, onToggle }: SidebarToggleProps) {
  return (
    <Tooltip label={hidden ? "Show sidebar" : "Hide sidebar"}>
      <button
        type="button"
        className="app__win-btn app__sidebar-toggle"
        onClick={onToggle}
        aria-label="Sidebar"
        aria-expanded={!hidden}
      >
        <PanelLeftIcon size={16} />
      </button>
    </Tooltip>
  );
}

export default SidebarToggle;
