// src/components/sidebar/VaultSwitcher.tsx
import type { Vaults } from "../../hooks/useVaults";
import { pickVaultPath } from "../../lib/vault";
import { vaultProblemText } from "../../lib/vaultList";
import type { OpenSettings } from "../dialogs/SettingsDialog";
import { useContextMenu } from "../ui/ContextMenuProvider";
import {
  ChevronDownIcon,
  FolderIcon,
  FolderPlusIcon,
  GearIcon,
} from "../ui/Icon";
import Tooltip from "../ui/Tooltip";

interface VaultSwitcherProps {
  vaults: Vaults;
  onOpenSettings: OpenSettings;
}

// The name of the open vault in the sidebar header; a click lists the others
function VaultSwitcher({ vaults, onOpenSettings }: VaultSwitcherProps) {
  const { openAt } = useContextMenu();
  const current = vaults.vaults.find((v) => v.path === vaults.active);

  const switchTo = async (path: string) => {
    // The folder is gone: the Vaults tab says so and offers to remove it
    if (!(await vaults.switchTo(path))) onOpenSettings("vaults");
  };

  const addVault = async () => {
    try {
      const chosen = await pickVaultPath();
      if (!chosen) return;
      const problem = await vaults.add(chosen);
      // Nowhere in the header to explain a refusal: the Vaults tab has room
      if (problem) onOpenSettings("vaults", vaultProblemText(problem));
    } catch (err) {
      console.error("[VaultSwitcher]", err);
    }
  };

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    openAt(r.left, r.bottom + 2, [
      ...vaults.vaults.map((v) => {
        const missing = vaults.isMissing(v.path);
        return {
          label: missing ? `${v.name} (folder not found)` : v.name,
          icon: <FolderIcon size={14} />,
          checked: v.path === vaults.active,
          disabled: missing,
          onSelect: () => switchTo(v.path),
        };
      }),
      "separator",
      {
        label: "Add vault…",
        icon: <FolderPlusIcon size={14} />,
        onSelect: addVault,
      },
      {
        label: "Manage vaults…",
        icon: <GearIcon size={14} />,
        onSelect: () => onOpenSettings("vaults"),
      },
    ]);
  };

  return (
    <Tooltip label={`Vault: ${current?.name ?? ""}`}>
      <button
        type="button"
        className="sidebar__vault"
        onClick={openMenu}
        aria-haspopup="menu"
      >
        <span>{current?.name ?? "Vault"}</span>
        <ChevronDownIcon size={12} />
      </button>
    </Tooltip>
  );
}

export default VaultSwitcher;
