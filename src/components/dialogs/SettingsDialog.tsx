// src/components/dialogs/SettingsDialog.tsx
import { type ReactNode, useState } from "react";
import type { Updater } from "../../hooks/useUpdater";
import type { Vaults } from "../../hooks/useVaults";
import AboutPanel from "../settings/AboutPanel";
import AppearancePanel from "../settings/AppearancePanel";
import AssistantsPanel from "../settings/AssistantsPanel";
import VaultsPanel from "../settings/VaultsPanel";
import Button from "../ui/Button";
import { FolderIcon, InfoIcon, PaletteIcon, SparklesIcon } from "../ui/Icon";
import Modal from "../ui/Modal";

export type SettingsTab = "appearance" | "vaults" | "assistants" | "about";

/** Opens Settings on a section (Appearance by default), optionally with a message for the Vaults section to show */
export type OpenSettings = (tab?: SettingsTab, message?: string) => void;

// The rows of the list on the left; FolderIcon is what the vault menu uses for a vault too
const SECTIONS: { value: SettingsTab; label: string; icon: ReactNode }[] = [
  { value: "appearance", label: "Appearance", icon: <PaletteIcon size={16} /> },
  { value: "vaults", label: "Vaults", icon: <FolderIcon size={16} /> },
  {
    value: "assistants",
    label: "AI assistants",
    icon: <SparklesIcon size={16} />,
  },
  { value: "about", label: "About", icon: <InfoIcon size={16} /> },
];

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
// and the open section on the right. It keeps a fixed height, so switching sections does not make it jump.
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
          <div className="modal__title settings__title">Settings</div>
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
          <header className="modal__header">
            <h2 className="modal__title">
              {SECTIONS.find((s) => s.value === tab)?.label}
            </h2>
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

      <footer className="modal__footer">
        <div className="modal__actions">
          <Button onClick={onClose}>Close</Button>
        </div>
      </footer>
    </Modal>
  );
}

export default SettingsDialog;
