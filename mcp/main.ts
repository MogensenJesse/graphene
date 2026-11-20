// mcp/main.ts
// Entry of the Graphene MCP server: `node graphene-mcp.mjs [--vault <folder>]`, spoken over stdio.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";
import { scanVault, vaultSource } from "./vault";

async function main() {
  const source = vaultSource(process.argv.slice(2), process.env);
  // Fail now, with a clear message, rather than on the first tool call: no vault at all, or none of them readable.
  // One unreadable vault among several (a drive that is not connected) only gets a note on stderr.
  const { vaults } = await source();
  const unreadable: string[] = [];
  for (const vault of vaults) {
    try {
      await scanVault(vault.path);
    } catch (err) {
      unreadable.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (vaults.length > 0 && unreadable.length === vaults.length)
    throw new Error(unreadable[0]);
  for (const message of unreadable) console.error(`graphene-mcp: ${message}`);

  await createServer(source).connect(new StdioServerTransport());
  // stdout carries the protocol, so anything for a human goes to stderr
  console.error(
    `graphene-mcp: serving ${vaults.map((v) => v.name).join(", ") || "no vault yet (none is shared)"}`,
  );
}

main().catch((err) => {
  console.error(`graphene-mcp: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
