// src/components/dialogs/VaultMissingBar.tsx
import Button from "../ui/Button";

interface VaultMissingBarProps {
  name: string;
  onRetry: () => void;
  onManage: () => void;
}

// Over a working app when the open vault's folder is not there (renamed, deleted, a drive unplugged) and something typed is not saved:
// nothing is unmounted, what was typed stays, and nothing is saved until the folder is back (see lib/vaultGone). With nothing to lose the
// app shows VaultUnavailable instead.
function VaultMissingBar({ name, onRetry, onManage }: VaultMissingBarProps) {
  return (
    <div className="vault-missing-bar" role="alert">
      <span className="vault-missing-bar__text">
        {name
          ? `The folder of "${name}" is not there.`
          : "The vault folder is not there."}{" "}
        What you typed stays here, but nothing is saved until the folder is
        back.
      </span>
      <Button variant="primary" size="sm" onClick={onRetry}>
        Try again
      </Button>
      <Button size="sm" onClick={onManage}>
        Manage vaults
      </Button>
    </div>
  );
}

export default VaultMissingBar;
