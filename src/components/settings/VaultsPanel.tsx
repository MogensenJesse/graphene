// src/components/settings/VaultsPanel.tsx
import { useEffect, useState } from "react";
import type { Vaults } from "../../hooks/useVaults";
import { pickVaultPath } from "../../lib/vault";
import { type VaultEntry, vaultProblemText } from "../../lib/vaultList";
import { ChevronDownIcon, ChevronUpIcon } from "../ui/Icon";
import InlineInput from "../ui/InlineInput";
import Tooltip from "../ui/Tooltip";

interface VaultsPanelProps {
  vaults: Vaults;
  /** Something to tell the person on arrival (the header's "Add vault…" was refused) */
  initialMessage: string | null;
  /** Closes Settings: a vault that was just opened is what the person wants to see */
  onClose: () => void;
}

// Add, open, rename, order and remove vaults, and choose which ones AI assistants may use
function VaultsPanel({ vaults, initialMessage, onClose }: VaultsPanelProps) {
  const { recheck } = vaults;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(initialMessage);

  // A folder may have been deleted, or a drive connected, since the list was last looked at
  useEffect(() => {
    recheck();
  }, [recheck]);

  const add = async () => {
    setMessage(null);
    try {
      const chosen = await pickVaultPath();
      if (!chosen) return;
      const problem = await vaults.add(chosen);
      if (problem) setMessage(vaultProblemText(problem));
    } catch (err) {
      console.error("[VaultsPanel]", err);
      setMessage("That folder could not be added.");
    }
  };

  const open = async (vault: VaultEntry) => {
    setMessage(null);
    if (await vaults.switchTo(vault.path)) onClose();
  };

  const rename = (vault: VaultEntry, name: string) => {
    setRenaming(null);
    if (name === vault.name) return;
    if (!vaults.rename(vault.path, name))
      setMessage(`Another vault is already called "${name}".`);
  };

  return (
    <>
      <p className="settings__text">
        A vault is a folder of notes. Switch between them from the top of the
        sidebar. Vaults cannot overlap: a folder may not be inside another
        vault.
      </p>

      <ul className="settings__vaults">
        {vaults.vaults.map((vault, index) => {
          const current = vault.path === vaults.active;
          const missing = vaults.isMissing(vault.path);
          return (
            <li key={vault.path} className="settings__vault">
              <div className="settings__vault-head">
                {renaming === vault.path ? (
                  <span className="settings__vault-rename" data-owns-escape>
                    <InlineInput
                      className="settings__input"
                      initial={vault.name}
                      ariaLabel={`New name for ${vault.name}`}
                      onCommit={(name) => rename(vault, name)}
                      onCancel={() => setRenaming(null)}
                    />
                  </span>
                ) : (
                  <Tooltip label="Rename">
                    <button
                      type="button"
                      className="settings__vault-name"
                      onClick={() => {
                        setMessage(null);
                        setRenaming(vault.path);
                      }}
                    >
                      {vault.name}
                    </button>
                  </Tooltip>
                )}
                {current && <span className="settings__tag">Open</span>}
                <span className="settings__vault-order">
                  <Tooltip label="Move up">
                    <button
                      type="button"
                      className="settings__icon-btn"
                      aria-label={`Move ${vault.name} up`}
                      disabled={index === 0}
                      onClick={() => vaults.move(vault.path, -1)}
                    >
                      <ChevronUpIcon size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Move down">
                    <button
                      type="button"
                      className="settings__icon-btn"
                      aria-label={`Move ${vault.name} down`}
                      disabled={index === vaults.vaults.length - 1}
                      onClick={() => vaults.move(vault.path, 1)}
                    >
                      <ChevronDownIcon size={14} />
                    </button>
                  </Tooltip>
                </span>
              </div>

              <p className="settings__vault-path">{vault.path}</p>
              {missing && (
                <p className="settings__error">
                  Folder not found. Connect the drive or remove this vault.
                </p>
              )}

              {removing === vault.path ? (
                <div className="settings__vault-confirm">
                  <p className="settings__muted">
                    Remove "{vault.name}" from Graphene? The folder and its
                    notes stay on your computer.
                  </p>
                  <div className="settings__row">
                    <button
                      type="button"
                      className="settings__btn settings__btn--danger"
                      onClick={() => {
                        setRemoving(null);
                        vaults.remove(vault.path);
                      }}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className="settings__btn"
                      onClick={() => setRemoving(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="settings__vault-foot">
                  <label className="settings__check">
                    <input
                      type="checkbox"
                      checked={vault.shared}
                      onChange={(e) =>
                        vaults.setShared(vault.path, e.target.checked)
                      }
                    />
                    Share with AI assistants
                  </label>
                  <span className="settings__vault-actions">
                    {!current && (
                      <button
                        type="button"
                        className="settings__link"
                        disabled={missing}
                        onClick={() => open(vault)}
                      >
                        Open
                      </button>
                    )}
                    <button
                      type="button"
                      className="settings__link"
                      onClick={() => {
                        setMessage(null);
                        setRemoving(vault.path);
                      }}
                    >
                      Remove
                    </button>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {message && (
        <p className="settings__error" role="alert">
          {message}
        </p>
      )}

      <div className="settings__row">
        <button
          type="button"
          className="settings__btn settings__btn--primary"
          onClick={add}
        >
          Add vault…
        </button>
      </div>
    </>
  );
}

export default VaultsPanel;
