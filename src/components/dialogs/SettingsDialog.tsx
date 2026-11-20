// src/components/dialogs/SettingsDialog.tsx
import { useState } from "react";
import type { Updater } from "../../hooks/useUpdater";
import type { Vaults } from "../../hooks/useVaults";
import AboutPanel from "../settings/AboutPanel";
import AppearancePanel from "../settings/AppearancePanel";
import AssistantsPanel from "../settings/AssistantsPanel";
import VaultsPanel from "../settings/VaultsPanel";
import Modal from "../ui/Modal";
import Segmented from "../ui/Segmented";

export type SettingsTab = "appearance" | "vaults" | "assistants" | "about";

/** Opens Settings on a tab (Appearance by default), optionally with a message for the Vaults tab to show */
export type OpenSettings = (tab?: SettingsTab, message?: string) => void;

const TABS: { value: SettingsTab; label: string }[] = [
  { value: "appearance", label: "Appearance" },
  { value: "vaults", label: "Vaults" },
  { value: "assistants", label: "AI assistants" },
  { value: "about", label: "About" },
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

// One dialog for everything that is not a note. It keeps a fixed height, so switching tabs does not make it jump.
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
      <header className="settings__header">
        <h2 className="settings__title">Settings</h2>
        <Segmented
          label="Settings section"
          className="settings__tabs"
          value={tab}
          options={TABS}
          onChange={setTab}
        />
      </header>

      <div className="settings__body">
        {tab === "appearance" && <AppearancePanel />}
        {tab === "vaults" && (
          <VaultsPanel
            vaults={vaults}
            initialMessage={initialMessage}
            onClose={onClose}
          />
        )}
        {tab === "assistants" && <AssistantsPanel version={updater.version} />}
        {tab === "about" && (
          <AboutPanel updater={updater} onShowUpdate={onShowUpdate} />
        )}
      </div>

      <footer className="settings__footer">
        <button type="button" className="settings__btn" onClick={onClose}>
          Close
        </button>
      </footer>
    </Modal>
  );
}

export default SettingsDialog;
