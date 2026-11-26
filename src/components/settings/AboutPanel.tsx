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
      <section className="settings__field">
        <h3 className="settings__label">Graphene</h3>
        <p className="settings__text">
          {version ? `Version ${version}` : "Version unknown"}
        </p>
      </section>

      {IS_ANDROID && (
        <section className="settings__field">
          <h3 className="settings__label">Your notes</h3>
          <p className="settings__text">{PRIVATE_VAULT_NOTICE}</p>
        </section>
      )}

      {update && (
        <p className="settings__notice">
          Version {update.version} is available.{" "}
          <Button variant="link" onClick={onShowUpdate}>
            See what changed and install
          </Button>
        </p>
      )}

      {/* Android has no updater: a new APK is installed over the old one */}
      {!IS_ANDROID && (
        <>
          <div className="settings__row settings__row--center">
            <Button disabled={busy} onClick={updater.checkNow}>
              Check for updates
            </Button>
            {result && (
              <span className="settings__muted" role="status">
                {result}
              </span>
            )}
          </div>

          <p className="settings__muted">
            {canInstall
              ? "Graphene also checks a few seconds after it starts."
              : "This is a development build: it never updates itself."}
          </p>
        </>
      )}

      <div className="settings__row">
        <Button
          variant="link"
          onClick={() => openUrl(RELEASES_PAGE).catch(console.error)}
        >
          Release notes on GitHub
        </Button>
      </div>
    </>
  );
}

export default AboutPanel;
