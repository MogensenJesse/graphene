// src/components/settings/AboutPanel.tsx
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Updater } from "../../hooks/useUpdater";
import { RELEASES_PAGE } from "../../lib/releaseNotes";

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

      {update && (
        <p className="settings__notice">
          Version {update.version} is available.{" "}
          <button
            type="button"
            className="settings__link"
            onClick={onShowUpdate}
          >
            See what changed and install
          </button>
        </p>
      )}

      <div className="settings__row settings__row--center">
        <button
          type="button"
          className="settings__btn"
          disabled={busy}
          onClick={updater.checkNow}
        >
          Check for updates
        </button>
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

      <div className="settings__row">
        <button
          type="button"
          className="settings__link"
          onClick={() => openUrl(RELEASES_PAGE).catch(console.error)}
        >
          Release notes on GitHub
        </button>
      </div>
    </>
  );
}

export default AboutPanel;
