// src/components/settings/AssistantsPanel.tsx
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
import Button from "../ui/Button";
import Select from "../ui/Select";

type Tab = "claude" | ClientId;
const TABS: { value: Tab; label: string }[] = [
  { value: "claude", label: "Claude app" },
  ...CLIENTS.map(({ id, label }) => ({ value: id, label })),
];

interface Files {
  script: string;
  extension: string;
}

interface AssistantsPanelProps {
  /** The installed Graphene version; empty until it has loaded */
  version: string;
}

// "AI assistants": how to register Graphene's MCP server (mcp/) with the Claude app and with other AI clients.
// What an assistant may do with the notes is set in the assistant's own permissions, not here.
function AssistantsPanel({ version }: AssistantsPanelProps) {
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
    <>
      <p className="settings__text">
        Let an assistant search, read and add to your notes.
      </p>

      <section className="settings__field">
        <h3 className="settings__label">Assistant</h3>
        <Select
          label="Assistant"
          className="settings__select"
          value={tab}
          options={TABS}
          onChange={setTab}
        />
      </section>

      {files === "error" && (
        <p className="settings__error" role="alert">
          The assistant files were not found next to the app. Reinstalling
          Graphene brings them back.
        </p>
      )}

      {tab === "claude" ? (
        <>
          {extensionIsOld(addedAt, version) && (
            <p className="settings__notice">
              Graphene has been updated since you added it to Claude (you added
              it at v{addedAt}). The Claude app does not update it on its own,
              so add it again to get the new version.
            </p>
          )}
          <p className="settings__text">
            Claude shows an install screen with one setting, the notes folder.
            Leave it empty to use the vaults shared in Settings, Vaults (all are
            shared unless you turn it off). A folder there limits Claude to that
            one.
          </p>
          <div className="settings__row">
            <Button variant="primary" disabled={!ready} onClick={addToClaude}>
              Add to Claude
            </Button>
            <Button
              disabled={!ready}
              onClick={() => {
                if (!ready) return;
                markAdded();
                revealItemInDir(ready.extension).catch(console.error);
              }}
            >
              Show in Explorer
            </Button>
          </div>
          <p className="settings__muted">
            {openFailed
              ? "Claude did not open it. Use Show in Explorer, then double-click graphene.mcpb, or drag it into Claude's Settings, Extensions."
              : "If nothing opens, use Show in Explorer, then double-click graphene.mcpb."}
          </p>
        </>
      ) : (
        client && (
          <>
            <p className="settings__text">{client.hint}</p>
            {snippet?.file && (
              <p className="settings__muted">
                File: <code>{snippet.file}</code>
              </p>
            )}
            {snippet && (
              <>
                <pre className="settings__code">{snippet.text}</pre>
                <div className="settings__row">
                  <Button variant="primary" onClick={() => copy(snippet.text)}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </>
            )}
            <p className="settings__muted">
              Needs Node.js 18 or newer. If the client cannot find it, give the
              full path to node in place of "node".
            </p>
          </>
        )
      )}

      <p className="settings__muted">
        Assistants you connect can read and change all your notes. Set what they
        may do in the assistant's own permissions. ChatGPT and Claude in a web
        browser cannot reach programs on your computer.
      </p>
    </>
  );
}

export default AssistantsPanel;
