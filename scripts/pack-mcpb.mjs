// scripts/pack-mcpb.mjs
// Packs the MCP server into dist-mcp/graphene.mcpb, a Claude Desktop extension: one file the Claude app installs by opening it.
// Needs `npm run build:mcp` first. Run as `npm run pack:mcpb`.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

const OUT = "dist-mcp";
const STAGE = `${OUT}/mcpb`;
const SERVER = "graphene-mcp.mjs";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

/** The placeholder the Claude app swaps for what the person chose in the install screen. */
const setting = (key) => `\${user_config.${key}}`;

const manifest = {
  manifest_version: "0.3",
  name: "graphene",
  display_name: "Graphene notes",
  version,
  description:
    "Lets Claude search, read and add to the notes in your Graphene vaults.",
  author: { name: "MogensenJesse" },
  repository: { type: "git", url: "https://github.com/MogensenJesse/graphene" },
  icon: "icon.png",
  server: {
    type: "node",
    entry_point: `server/${SERVER}`,
    mcp_config: {
      command: "node",
      args: [`\${__dirname}/server/${SERVER}`],
      // The server treats an empty value as "not set" (mcp/vault.ts)
      env: { GRAPHENE_VAULT: setting("vault") },
    },
  },
  user_config: {
    vault: {
      type: "directory",
      title: "Notes folder",
      description:
        "Leave empty to use the vaults you share in Graphene (Settings, Vaults). A folder here uses only that one.",
      required: false,
    },
  },
};

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(`${STAGE}/server`, { recursive: true });
copyFileSync(`${OUT}/${SERVER}`, `${STAGE}/server/${SERVER}`);
copyFileSync("src-tauri/icons/icon.png", `${STAGE}/icon.png`); // 512×512, the size Claude Desktop recommends
writeFileSync(
  `${STAGE}/manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);

// The package does not export its CLI, and running it through node avoids the .cmd shim (and its shell) on Windows
execFileSync(
  process.execPath,
  [
    "node_modules/@anthropic-ai/mcpb/dist/cli/cli.js",
    "pack",
    STAGE,
    `${OUT}/graphene.mcpb`,
  ],
  { stdio: "inherit" },
);
