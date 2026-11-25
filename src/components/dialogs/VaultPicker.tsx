// src/components/dialogs/VaultPicker.tsx
import { useState } from "react";
import { pickVaultPath } from "../../lib/vault";
import AppBand from "../ui/AppBand";
import Button from "../ui/Button";
import { HexagonIcon } from "../ui/Icon";

interface VaultPickerProps {
  /** Adds the folder as a vault and opens it */
  onChoose: (path: string) => Promise<unknown>;
  /** The saved list of vaults could not be read */
  unreadable?: boolean;
}

// The first screen: choose the folder that holds the notes
function VaultPicker({ onChoose, unreadable }: VaultPickerProps) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChoose = async () => {
    setPicking(true);
    setError(null);
    try {
      const chosen = await pickVaultPath();
      if (chosen) await onChoose(chosen);
    } catch (err) {
      setError("Failed to pick folder. Please try again.");
      console.error("[VaultPicker]", err);
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="vault-picker" data-tauri-drag-region>
      <div className="vault-picker__card">
        <div className="vault-picker__icon" aria-hidden="true">
          <HexagonIcon size={36} />
        </div>
        <h1 className="vault-picker__title">Graphene</h1>
        <p className="vault-picker__desc">
          Choose a folder to use as your vault. Your notes will be stored as
          files inside it.
        </p>
        {unreadable && (
          <p className="vault-picker__error">
            Graphene could not read its list of vaults. The old file was kept as
            config.json.bak next to it. Choose your vault folder again.
          </p>
        )}
        {error && <p className="vault-picker__error">{error}</p>}
        <Button
          variant="solid"
          size="lg"
          onClick={handleChoose}
          disabled={picking}
        >
          {picking ? "Choosing…" : "Choose vault folder"}
        </Button>
      </div>
      <AppBand />
    </div>
  );
}

export default VaultPicker;
