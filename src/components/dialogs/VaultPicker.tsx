// src/components/dialogs/VaultPicker.tsx
import { useState } from "react";
import { pickVaultPath, setVaultPath } from "../../lib/vault";
import { HexagonIcon } from "../ui/Icon";
import WindowControls from "../ui/WindowControls";

// The first screen: choose the folder that holds the notes
function VaultPicker({ onVaultSet }: { onVaultSet: (path: string) => void }) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChoose = async () => {
    setPicking(true);
    setError(null);
    try {
      const chosen = await pickVaultPath();
      if (chosen) {
        await setVaultPath(chosen);
        onVaultSet(chosen);
      }
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
        {error && <p className="vault-picker__error">{error}</p>}
        <button
          type="button"
          className="vault-picker__btn"
          onClick={handleChoose}
          disabled={picking}
        >
          {picking ? "Choosing…" : "Choose vault folder"}
        </button>
      </div>
      <WindowControls className="vault-picker__win-controls" />
    </div>
  );
}

export default VaultPicker;
