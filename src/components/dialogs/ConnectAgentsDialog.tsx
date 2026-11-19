// src/components/dialogs/ConnectAgentsDialog.tsx
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useClipboard } from "../../hooks/useClipboard";
import { mcpExtensionPath, mcpScriptPath } from "../../lib/mcpBundle";
import { CLIENTS, type ClientId, connectSnippet } from "../../lib/mcpClients";
import {
  extensionAddedAt,
  extensionIsOld,
  rememberExtensionAdded,
} from "../../lib/mcpExtension";
import Modal from "../ui/Modal";

type Tab = "claude" | ClientId;
const TABS: { id: Tab; label: string }[] = [
  { id: "claude", label: "Claude app" },
  ...CLIENTS,
];

interface Files {
  script: string;
  extension: string;
}

interface ConnectAgentsDialogProps {
  /** The installed Graphene version; empty until it has loaded */
  version: string;
  onClose: () => void;
}

// "Connect AI assistants": how to register Graphene's MCP server (mcp/) with the Claude app and with other AI clients.
// What an assistant may do with the notes is set in the assistant's own permissions, not here.
function ConnectAgentsDialog({ version, onClose }: ConnectAgentsDialogProps) {
  const [tab, setTab] = useState<Tab>("claude");
  const [addedAt, setAddedAt] = useState(extensionAddedAt);
  const [files, setFiles] = useState<Files | "error" | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const { copy, copied } = useClipboard();

  useEffect(() => {
    Promise.all([mcpScriptPath(), mcpExtensionPath()])
      .then(([script, extension]) => setFiles({ script, extension }))
      .catch((err) => {
        console.error(err);
        setFiles("error");
      });
  }, []);

  const ready = files && files !== "error" ? files : null;
  const client = CLIENTS.find((c) => c.id === tab);
  const snippet =
    client && ready ? connectSnippet(client.id, ready.script) : null;

  // Both buttons hand the person the current extension file
  const markAdded = () => {
    if (!version) return;
    rememberExtensionAdded(version);
    setAddedAt(version);
  };

  const addToClaude = () => {
    if (!ready) return;
    setOpenFailed(false);
    markAdded();
    // The Claude app is the registered handler for .mcpb files and shows its own install screen
    openPath(ready.extension).catch((err) => {
      console.error(err);
      setOpenFailed(true);
    });
  };

  return (
    <Modal
      label="Connect AI assistants"
      onClose={onClose}
      className="connect-dialog"
    >
      <header className="connect-dialog__header">
        <h2 className="connect-dialog__title">Connect AI assistants</h2>
        <p className="connect-dialog__sub">
          Let an assistant search, read and add to your notes.
        </p>
      </header>

      <div className="connect-dialog__body">
        <div className="connect-dialog__tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="connect-dialog__tab"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {files === "error" && (
          <p className="connect-dialog__error" role="alert">
            The assistant files were not found next to the app. Reinstalling
            Graphene brings them back.
          </p>
        )}

        {tab === "claude" ? (
          <>
            {extensionIsOld(addedAt, version) && (
              <p className="connect-dialog__notice">
                Graphene has been updated since you added it to Claude (you
                added it at v{addedAt}). The Claude app does not update it on
                its own, so add it again to get the new version.
              </p>
            )}
            <p className="connect-dialog__text">
              Claude shows an install screen with one setting, the notes folder.
              Leave it empty to use the vault Graphene has open.
            </p>
            <div className="connect-dialog__row">
              <button
                type="button"
                className="connect-dialog__btn connect-dialog__btn--primary"
                disabled={!ready}
                onClick={addToClaude}
              >
                Add to Claude
              </button>
              <button
                type="button"
                className="connect-dialog__btn"
                disabled={!ready}
                onClick={() => {
                  if (!ready) return;
                  markAdded();
                  revealItemInDir(ready.extension).catch(console.error);
                }}
              >
                Show file
              </button>
            </div>
            <p className="connect-dialog__muted">
              {openFailed
                ? "Claude did not open it. Use Show file, then double-click graphene.mcpb, or drag it into Claude's Settings, Extensions."
                : "If nothing opens, use Show file, then double-click graphene.mcpb."}
            </p>
          </>
        ) : (
          client && (
            <>
              <p className="connect-dialog__text">{client.hint}</p>
              {snippet?.file && (
                <p className="connect-dialog__muted">
                  File: <code>{snippet.file}</code>
                </p>
              )}
              {snippet && (
                <>
                  <pre className="connect-dialog__code">{snippet.text}</pre>
                  <div className="connect-dialog__row">
                    <button
                      type="button"
                      className="connect-dialog__btn connect-dialog__btn--primary"
                      onClick={() => copy(snippet.text)}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </>
              )}
              <p className="connect-dialog__muted">
                Needs Node.js 18 or newer. If the client cannot find it, give
                the full path to node in place of "node".
              </p>
            </>
          )
        )}
      </div>

      <footer className="connect-dialog__footer">
        <p className="connect-dialog__muted">
          Assistants you connect can read and change all your notes. Set what
          they may do in the assistant's own permissions. ChatGPT and Claude in
          a web browser cannot reach programs on your computer.
        </p>
        <div className="connect-dialog__row connect-dialog__row--end">
          <button
            type="button"
            className="connect-dialog__btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </footer>
    </Modal>
  );
}

export default ConnectAgentsDialog;
