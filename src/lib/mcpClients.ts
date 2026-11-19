// src/lib/mcpClients.ts
// What to show someone who connects their own AI client to the Graphene MCP server (mcp/server.ts, shipped as mcp/graphene-mcp.mjs).
// Every client runs the same thing: `node <script>`. They differ in how it is registered. The Claude app takes the .mcpb instead.

export type ClientId =
  | "claude-code"
  | "codex"
  | "cursor"
  | "vscode"
  | "gemini"
  | "other";

export interface Client {
  id: ClientId;
  label: string;
  hint: string;
}

export const CLIENTS: Client[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    hint: "Run this in a terminal.",
  },
  {
    id: "cursor",
    label: "Cursor",
    hint: "Add this to the file below (merge it with any servers already there), then restart Cursor.",
  },
  {
    id: "codex",
    label: "ChatGPT desktop / Codex",
    hint: "Run this in a terminal. The ChatGPT desktop app uses Codex's list of servers; or add it there under Settings, MCP servers, Add server, STDIO (command: node).",
  },
  {
    id: "vscode",
    label: "VS Code (Copilot)",
    hint: "Add this to the file below (merge it with any servers already there), then reload VS Code.",
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    hint: "Run this in a terminal.",
  },
  {
    id: "other",
    label: "Other",
    hint: "Most clients that run a local MCP server take this JSON. Look in your client's docs for where it goes.",
  },
];

export interface Snippet {
  /** A command for a terminal, or JSON to paste into `file`. */
  text: string;
  /** Set when `text` is JSON and the client reads it from a known file. */
  file?: string;
}

// ponytail: a path holding ", $ or ` is not escaped for a shell; install paths do not, and the JSON forms do escape.
const quote = (path: string) => `"${path}"`;

const json = (script: string, file?: string): Snippet => ({
  text: JSON.stringify(
    { mcpServers: { graphene: { command: "node", args: [script] } } },
    null,
    2,
  ),
  file,
});

/** The command or JSON that registers the server at `scriptPath`. */
export function connectSnippet(client: ClientId, scriptPath: string): Snippet {
  // `--` ends the client's own options, so what follows is the command to run
  const run = `node ${quote(scriptPath)}`;
  switch (client) {
    case "claude-code":
      return { text: `claude mcp add --scope user graphene -- ${run}` };
    case "codex":
      return { text: `codex mcp add graphene -- ${run}` };
    case "gemini":
      return { text: `gemini mcp add --scope user graphene -- ${run}` };
    case "cursor":
      return json(scriptPath, "~/.cursor/mcp.json");
    case "vscode":
      return json(scriptPath, "~/.copilot/mcp-config.json");
    case "other":
      return json(scriptPath);
  }
}
