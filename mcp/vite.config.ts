// mcp/vite.config.ts
// Bundles the MCP server and everything it imports into one file, so it runs with just `node`: npm run build:mcp
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    ssr: "mcp/main.ts",
    outDir: "dist-mcp",
    emptyOutDir: true,
    rolldownOptions: { output: { entryFileNames: "graphene-mcp.mjs" } },
  },
  ssr: { noExternal: true },
});
