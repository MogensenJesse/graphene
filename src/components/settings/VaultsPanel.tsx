// src/components/settings/VaultsPanel.tsx
import { useEffect, useState } from "react";
import type { Vaults } from "../../hooks/useVaults";
import { IS_ANDROID, PRIVATE_VAULT_NOTICE } from "../../lib/platform";
import { pickVaultPath } from "../../lib/vault";
import {
  nameTaken,
  type VaultEntry,
  vaultProblemText,
} from "../../lib/vaultList";
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

// Add, open, rename, order and remove vaults, and choose which ones AI assistants may use. On Android the vaults are folders the app
// keeps inside its own storage (no folder picker, no assistants, no order): a new one needs a name, and deleting one deletes its notes.
function VaultsPanel({ vaults, initialMessage, onClose }: VaultsPanelProps) {
  const { recheck } = vaults;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
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

  // Android: the name is all a new vault needs; it opens at once, so Settings closes on it as it does for Open
  const create = async (name: string) => {
    setNaming(false);
    const result = await vaults.create(name);
    if (result === "created") onClose();
    else if (result === "failed") setMessage("The vault could not be made.");
  };

  // Android: the last vault has no Delete, so the app always has one
  const erase = async (vault: VaultEntry) => {
    if ((await vaults.erase(vault.path)) === "failed")
      setMessage(
        `"${vault.name}" is gone from the list, but its files could not be deleted.`,
      );
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
          ? `A vault is a separate set of notes. Switch between them from the top of the list. ${PRIVATE_VAULT_NOTICE}`
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
                {current && (!IS_ANDROID || vaults.vaults.length > 1) && (
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
                  question={
                    IS_ANDROID
                      ? `Delete "${vault.name}" and every note in it? This cannot be undone.`
                      : `Remove "${vault.name}" from Graphene? The folder and its notes stay on your computer.`
                  }
                  confirmLabel={IS_ANDROID ? "Delete" : "Remove"}
                  onConfirm={() => {
                    setRemoving(null);
                    if (IS_ANDROID) erase(vault);
                    else vaults.remove(vault.path);
                  }}
                  onCancel={() => setRemoving(null)}
                />
              ) : (
                // On Android with one vault there is nothing to open or delete
                (!IS_ANDROID || vaults.vaults.length > 1) && (
                  <div className="settings__vault-foot">
                    {!IS_ANDROID && (
                      // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders an <input>
                      <label className="settings__check">
                        <Checkbox
                          checked={vault.shared}
                          onChange={(e) =>
                            vaults.setShared(vault.path, e.target.checked)
                          }
                        />
                        Share with AI assistants
                      </label>
                    )}
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
                        {IS_ANDROID ? "Delete" : "Remove"}
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

      <div className="settings__row">
        {IS_ANDROID && naming ? (
          <span data-owns-escape>
            <InlineInput
              className="settings__input"
              placeholder="Name of the vault"
              ariaLabel="Name of the new vault"
              validate={(name) =>
                nameTaken(vaults.vaults, name)
                  ? `Another vault is already called "${name}".`
                  : null
              }
              onCommit={create}
              onCancel={() => setNaming(false)}
            />
          </span>
        ) : (
          <Button
            variant="primary"
            onClick={
              IS_ANDROID
                ? () => {
                    setMessage(null);
                    setNaming(true);
                  }
                : add
            }
          >
            {IS_ANDROID ? "New vault…" : "Add vault…"}
          </Button>
        )}
      </div>
    </>
  );
}

export default VaultsPanel;
