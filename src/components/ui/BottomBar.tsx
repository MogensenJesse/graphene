// src/components/ui/BottomBar.tsx
import type { SidebarTab } from "../sidebar/Sidebar";
import { TABS } from "../sidebar/Sidebar";
import Segmented from "./Segmented";

interface BottomBarProps {
  tab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
}

/** A phone's Notes | Tasks, at the bottom where the thumb is, on the list and on the screens above it (see App, `phone`). */
function BottomBar({ tab, onTab }: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <Segmented label="Sections" value={tab} options={TABS} onChange={onTab} />
    </div>
  );
}

export default BottomBar;
