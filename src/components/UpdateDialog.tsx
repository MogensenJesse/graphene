// src/components/UpdateDialog.tsx
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Update } from "@tauri-apps/plugin-updater";
import ReactMarkdown from "react-markdown";
import type { UpdateStatus } from "../hooks/useUpdater";
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from "../lib/markdown";
import { RELEASES_PAGE, type ReleaseNote } from "../lib/releaseNotes";
import Modal from "./Modal";

interface UpdateDialogProps {
  current: string;
  update: Update;
  notes: ReleaseNote[];
  status: UpdateStatus;
  progress: number;
  error: string | null;
  canInstall: boolean;
  onInstall: () => void;
  onClose: () => void;
}

const noop = () => {};

const dateOf = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" })
    : "";

// "Update available": every version between the installed one and the latest, newest first
function UpdateDialog({
  current,
  update,
  notes,
  status,
  progress,
  error,
  canInstall,
  onInstall,
  onClose,
}: UpdateDialogProps) {
  const installing = status === "installing";
  // The releases list is unreachable (offline, rate limit): fall back to the latest version's notes
  const sections: ReleaseNote[] =
    notes.length > 0
      ? notes
      : [
          {
            version: update.version,
            date: update.date ?? "",
            body: update.body ?? "",
          },
        ];

  return (
    // Closing mid-download would hide the progress, so the dialog stays until the install ends
    <Modal
      label="Update available"
      onClose={installing ? noop : onClose}
      className="update-dialog"
    >
      <header className="update-dialog__header">
        <h2 className="update-dialog__title">Update available</h2>
        <p className="update-dialog__sub">
          You have v{current} · latest is v{update.version}
        </p>
      </header>

      <div className="update-dialog__body">
        {sections.map((note) => (
          <section key={note.version} className="update-dialog__release">
            <h3 className="update-dialog__version">
              v{note.version}
              {note.date && (
                <span className="update-dialog__date">{dateOf(note.date)}</span>
              )}
            </h3>
            <div className="update-dialog__markdown">
              <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                components={MARKDOWN_COMPONENTS}
              >
                {note.body || "No release notes."}
              </ReactMarkdown>
            </div>
          </section>
        ))}
      </div>

      <footer className="update-dialog__footer">
        {installing && (
          <progress
            className="update-dialog__progress"
            value={progress}
            max={1}
            aria-label="Download progress"
          />
        )}
        {error && (
          <p className="update-dialog__error" role="alert">
            {error}{" "}
            <button
              type="button"
              className="update-dialog__link"
              onClick={() => openUrl(RELEASES_PAGE).catch(console.error)}
            >
              Download it from GitHub
            </button>
          </p>
        )}
        <div className="update-dialog__actions">
          <button
            type="button"
            className="update-dialog__btn"
            onClick={onClose}
            disabled={installing}
          >
            Later
          </button>
          <button
            type="button"
            className="update-dialog__btn update-dialog__btn--primary"
            onClick={onInstall}
            disabled={installing || !canInstall}
            title={
              canInstall ? undefined : "Not available in a development build"
            }
          >
            {installing ? "Installing…" : "Install and restart"}
          </button>
        </div>
      </footer>
    </Modal>
  );
}

export default UpdateDialog;
