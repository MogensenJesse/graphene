// src/components/dialogs/SettingsDialog.tsx
import { type ReactNode, useState } from "react";
import type { Updater } from "../../hooks/useUpdater";
import type { Vaults } from "../../hooks/useVaults";
import { IS_ANDROID } from "../../lib/platform";
import AboutPanel from "../settings/AboutPanel";
import AppearancePanel from "../settings/AppearancePanel";
import AssistantsPanel from "../settings/AssistantsPanel";
import VaultsPanel from "../settings/VaultsPanel";
import {
  ChevronLeftIcon,
  FolderIcon,
  InfoIcon,
  PaletteIcon,
  SparklesIcon,
  XIcon,
} from "../ui/Icon";
import IconButton from "../ui/IconButton";
import Modal from "../ui/Modal";
import Tooltip from "../ui/Tooltip";

export type SettingsTab = "appearance" | "vaults" | "assistants" | "about";

/** Opens Settings on a section (Appearance by default), optionally with a message for the Vaults section to show */
export type OpenSettings = (tab?: SettingsTab, message?: string) => void;

// The rows of the list on the left; FolderIcon is what the vault menu uses for a vault too
const ALL_SECTIONS: { value: SettingsTab; label: string; icon: ReactNode }[] = [
  { value: "appearance", label: "Appearance", icon: <PaletteIcon size={16} /> },
  { value: "vaults", label: "Vaults", icon: <FolderIcon size={16} /> },
  {
    value: "assistants",
    label: "AI assistants",
    icon: <SparklesIcon size={16} />,
  },
  { value: "about", label: "About", icon: <InfoIcon size={16} /> },
];

// The assistants connect through a program on the computer (the MCP server), which Android cannot run
const SECTIONS = ALL_SECTIONS.filter(
  ({ value }) => !(IS_ANDROID && value === "assistants"),
);

interface SettingsDialogProps {
  initialTab: SettingsTab;
  initialMessage: string | null;
  updater: Updater;
  vaults: Vaults;
  /** Opens the update dialog; Settings closes for it */
  onShowUpdate: () => void;
  onClose: () => void;
}

// One dialog for everything that is not a note: a list of sections on the left, built from the sidebar's own nav rows,
// and the open section on the right. It keeps a fixed height, so switching sections does not make it jump. Escape, a
// click outside and the button in the header close it; on a touch screen it is a screen of its own and the arrow does.
function SettingsDialog({
  initialTab,
  initialMessage,
  updater,
  vaults,
  onShowUpdate,
  onClose,
}: SettingsDialogProps) {
  const [tab, setTab] = useState(initialTab);

  return (
    <Modal label="Settings" onClose={onClose} className="settings">
      <div className="settings__layout">
        <div className="settings__side">
          <div className="settings__head">
            {/* Only on a touch screen, where Settings is a screen of its own (_Touch.scss): the way back, as in every other screen */}
            <IconButton
              className="settings__back"
              aria-label="Back"
              onClick={onClose}
            >
              <ChevronLeftIcon size={18} />
            </IconButton>
            <div className="modal__title settings__title">Settings</div>
          </div>
          <nav className="settings__nav" aria-label="Settings sections">
            {SECTIONS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                className={`sidebar__nav-item${tab === value ? " sidebar__nav-item--active" : ""}`}
                aria-current={tab === value ? "page" : undefined}
                // The dialog opens with the focus on the section it shows
                data-autofocus={tab === value ? "" : undefined}
                onClick={() => setTab(value)}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="settings__main">
          <header className="modal__header settings__header">
            <h2 className="modal__title">
              {SECTIONS.find((s) => s.value === tab)?.label}
            </h2>
            <Tooltip label="Close" keys="Esc">
              <IconButton
                className="settings__close"
                aria-label="Close"
                onClick={onClose}
              >
                <XIcon size={14} />
              </IconButton>
            </Tooltip>
          </header>

          <div className="modal__body settings__body" data-scrollbar>
            {tab === "appearance" && <AppearancePanel />}
            {tab === "vaults" && (
              <VaultsPanel
                vaults={vaults}
                initialMessage={initialMessage}
                onClose={onClose}
              />
            )}
            {tab === "assistants" && (
              <AssistantsPanel version={updater.version} />
            )}
            {tab === "about" && (
              <AboutPanel updater={updater} onShowUpdate={onShowUpdate} />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default SettingsDialog;
