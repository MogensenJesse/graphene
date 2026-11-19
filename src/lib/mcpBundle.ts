// src/lib/mcpBundle.ts
// The MCP server files the installer puts next to the app (bundle.resources in src-tauri/tauri.conf.json).
import { resolveResource } from "@tauri-apps/api/path";

// Windows can hand back the \\?\ form of a path, which nobody should have to paste into an AI client
const plain = (path: string) => path.replace(/^\\\\\?\\/, "");

/** The server script, which every client but the Claude app runs with node. */
export const mcpScriptPath = () =>
  resolveResource("mcp/graphene-mcp.mjs").then(plain);

/** The Claude Desktop extension (.mcpb) that wraps the same script. */
export const mcpExtensionPath = () =>
  resolveResource("mcp/graphene.mcpb").then(plain);
