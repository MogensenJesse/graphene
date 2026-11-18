// src/components/sidebar/ThemeButton.tsx
import { useTheme } from "../../hooks/useTheme";
import { MonitorIcon, MoonIcon, SunIcon } from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

const LABEL = { system: "System", light: "Light", dark: "Dark" } as const;

// One button in the sidebar footer: click to go system, light, dark
function ThemeButton() {
  const { pref, cycle } = useTheme();
  const Icon =
    pref === "light" ? SunIcon : pref === "dark" ? MoonIcon : MonitorIcon;
  return (
    <Tooltip label={`Theme: ${LABEL[pref]} · click to change`}>
      <button
        type="button"
        className="sidebar__theme-btn"
        onClick={cycle}
        aria-label={`Theme: ${LABEL[pref]}. Click to change`}
      >
        <Icon size={16} />
      </button>
    </Tooltip>
  );
}

export default ThemeButton;
