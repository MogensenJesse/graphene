// mcp/main.ts
// Entry of the Graphene MCP server: `node graphene-mcp.mjs [--vault <folder>]`, spoken over stdio.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";
import { resolveVaultPath, scanVault } from "./vault";

async function main() {
  const vault = await resolveVaultPath(process.argv.slice(2), process.env);
  await scanVault(vault); // fail now, with a clear message, rather than on the first tool call
  const server = createServer(vault);
  await server.connect(new StdioServerTransport());
  // stdout carries the protocol, so anything for a human goes to stderr
  console.error(`graphene-mcp: serving ${vault}`);
}

main().catch((err) => {
  console.error(`graphene-mcp: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
