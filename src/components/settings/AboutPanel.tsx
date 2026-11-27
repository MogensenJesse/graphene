// src/components/settings/AboutPanel.tsx
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Updater } from "../../hooks/useUpdater";
import { IS_ANDROID, PRIVATE_VAULT_NOTICE } from "../../lib/platform";
import { RELEASES_PAGE } from "../../lib/releaseNotes";
import Button from "../ui/Button";

interface AboutPanelProps {
  updater: Updater;
  /** Opens the update dialog (what changed, Install and restart) */
  onShowUpdate: () => void;
}

// The version and the update check. The sidebar header only shows an "Update" pill while there is one to install.
function AboutPanel({ updater, onShowUpdate }: AboutPanelProps) {
  const { version, status, update, error, canInstall } = updater;
  const busy = status === "checking" || status === "installing";
  const result =
    status === "checking"
      ? "Checking…"
      : status === "up-to-date"
        ? "You have the latest version."
        : status === "error"
          ? `The check failed${error ? `: ${error}` : "."}`
          : null;

  return (
    <>
      {update && (
        <p className="settings__notice">
          Version {update.version} is available.{" "}
          <Button variant="link" onClick={onShowUpdate}>
            See what changed and install
          </Button>
        </p>
      )}

      <div className="settings__group">
        <section className="settings__field">
          <h3 className="settings__label">Version</h3>
          <span className="settings__value">{version ?? "Unknown"}</span>
        </section>

        {IS_ANDROID && (
          <section className="settings__field">
            <h3 className="settings__label">Your notes</h3>
            <p className="settings__muted">{PRIVATE_VAULT_NOTICE}</p>
          </section>
        )}

        {/* Android has no updater: a new APK is installed over the old one */}
        {!IS_ANDROID && (
          <section className="settings__field">
            <h3 className="settings__label">Updates</h3>
            <Button
              className="settings__control"
              disabled={busy}
              onClick={updater.checkNow}
            >
              Check for updates
            </Button>
            {result && (
              <p className="settings__muted" role="status">
                {result}
              </p>
            )}
            <p className="settings__muted">
              {canInstall
                ? "Graphene also checks a few seconds after it starts."
                : "This is a development build: it never updates itself."}
            </p>
          </section>
        )}

        <section className="settings__field">
          <h3 className="settings__label">Release notes</h3>
          <Button
            variant="link"
            className="settings__control"
            onClick={() => openUrl(RELEASES_PAGE).catch(console.error)}
          >
            View on GitHub
          </Button>
        </section>
      </div>
    </>
  );
}

export default AboutPanel;
