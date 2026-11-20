// src/components/dialogs/VaultUnavailable.tsx

interface VaultUnavailableProps {
  name: string;
  path: string;
  onRetry: () => void;
  onManage: () => void;
}

// Shown in place of the note when the vault's folder cannot be opened (deleted, renamed, a drive that is not connected)
function VaultUnavailable({
  name,
  path,
  onRetry,
  onManage,
}: VaultUnavailableProps) {
  return (
    <div className="vault-unavailable">
      <h2 className="vault-unavailable__title">
        {name ? `"${name}" cannot be opened` : "This vault cannot be opened"}
      </h2>
      <p className="vault-unavailable__text">
        Graphene did not find the folder <code>{path}</code>. If it is on a
        drive or network share, connect it and try again. Your notes are not
        touched.
      </p>
      <div className="vault-unavailable__row">
        <button
          type="button"
          className="vault-unavailable__btn vault-unavailable__btn--primary"
          onClick={onRetry}
        >
          Try again
        </button>
        <button
          type="button"
          className="vault-unavailable__btn"
          onClick={onManage}
        >
          Manage vaults
        </button>
      </div>
    </div>
  );
}

export default VaultUnavailable;
