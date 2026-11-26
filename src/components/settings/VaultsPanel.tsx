// src/components/settings/VaultsPanel.tsx
import { useEffect, useState } from "react";
import type { Vaults } from "../../hooks/useVaults";
import { IS_ANDROID, PRIVATE_VAULT_NOTICE } from "../../lib/platform";
import { pickVaultPath } from "../../lib/vault";
import { type VaultEntry, vaultProblemText } from "../../lib/vaultList";
import Button from "../ui/Button";
import Checkbox from "../ui/Checkbox";
import ConfirmBar from "../ui/ConfirmBar";
import { ChevronDownIcon, ChevronUpIcon } from "../ui/Icon";
import IconButton from "../ui/IconButton";
import InlineInput from "../ui/InlineInput";
import Tooltip from "../ui/Tooltip";

interface VaultsPanelProps {
  vaults: Vaults;
  /** Something to tell the person on arrival (the header's "Add vault…" was refused) */
  initialMessage: string | null;
  /** Closes Settings: a vault that was just opened is what the person wants to see */
  onClose: () => void;
}

// Add, open, rename, order and remove vaults, and choose which ones AI assistants may use. On Android there is the one vault
// inside the app (no folder picker, no assistants, nothing to order or remove), so it is a name and a warning.
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
    if ((await vaults.switchTo(vault.path)) === "opened") onClose();
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
        {IS_ANDROID
          ? PRIVATE_VAULT_NOTICE
          : "A vault is a folder of notes. Switch between them from the top of the sidebar. Vaults cannot overlap: a folder may not be inside another vault."}
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
                {current && !IS_ANDROID && (
                  <span className="settings__tag">Open</span>
                )}
                {!IS_ANDROID && (
                  <span className="settings__vault-order">
                    <Tooltip label="Move up">
                      <IconButton
                        size="sm"
                        aria-label={`Move ${vault.name} up`}
                        disabled={index === 0}
                        onClick={() => vaults.move(vault.path, -1)}
                      >
                        <ChevronUpIcon size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="Move down">
                      <IconButton
                        size="sm"
                        aria-label={`Move ${vault.name} down`}
                        disabled={index === vaults.vaults.length - 1}
                        onClick={() => vaults.move(vault.path, 1)}
                      >
                        <ChevronDownIcon size={14} />
                      </IconButton>
                    </Tooltip>
                  </span>
                )}
              </div>

              {!IS_ANDROID && (
                <p className="settings__vault-path">{vault.path}</p>
              )}
              {missing && (
                <p className="settings__error">
                  Folder not found. Connect the drive or remove this vault.
                </p>
              )}

              {removing === vault.path ? (
                <ConfirmBar
                  question={`Remove "${vault.name}" from Graphene? The folder and its notes stay on your computer.`}
                  confirmLabel="Remove"
                  onConfirm={() => {
                    setRemoving(null);
                    vaults.remove(vault.path);
                  }}
                  onCancel={() => setRemoving(null)}
                />
              ) : (
                !IS_ANDROID && (
                  <div className="settings__vault-foot">
                    {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders an <input> */}
                    <label className="settings__check">
                      <Checkbox
                        checked={vault.shared}
                        onChange={(e) =>
                          vaults.setShared(vault.path, e.target.checked)
                        }
                      />
                      Share with AI assistants
                    </label>
                    <span className="settings__vault-actions">
                      {!current && (
                        <Button
                          variant="link"
                          disabled={missing}
                          onClick={() => open(vault)}
                        >
                          Open
                        </Button>
                      )}
                      <Button
                        variant="link"
                        onClick={() => {
                          setMessage(null);
                          setRemoving(vault.path);
                        }}
                      >
                        Remove
                      </Button>
                    </span>
                  </div>
                )
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

      {!IS_ANDROID && (
        <div className="settings__row">
          <Button variant="primary" onClick={add}>
            Add vault…
          </Button>
        </div>
      )}
    </>
  );
}

export default VaultsPanel;
