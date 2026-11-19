// mcp/vault.test.ts
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "vitest";
import { joinPath } from "../src/lib/paths";
import { resolveVaultPath } from "./vault";

// What a client passes when it never filled in the setting
const unfilled = (key: string) => `\${user_config.${key}}`;

test("the vault is the flag, then GRAPHENE_VAULT, then Graphene's own config; an unfilled value is ignored", async () => {
  assert.equal(
    await resolveVaultPath(["--vault", "C:\\notes"], {}),
    "C:/notes",
  );
  assert.equal(await resolveVaultPath(["--vault=C:\\notes"], {}), "C:/notes");
  assert.equal(await resolveVaultPath([], { GRAPHENE_VAULT: "D:\\n" }), "D:/n");

  const appData = mkdtempSync(joinPath(tmpdir(), "graphene-appdata-"));
  try {
    const dir = joinPath(appData, "com.graphene.app", "graphene");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      joinPath(dir, "config.json"),
      JSON.stringify({ vaultPath: "E:\\vault" }),
    );
    for (const value of ["", unfilled("vault")])
      assert.equal(
        await resolveVaultPath([], {
          GRAPHENE_VAULT: value,
          APPDATA: appData,
        }),
        "E:/vault",
        value,
      );
    await assert.rejects(
      resolveVaultPath([], { APPDATA: joinPath(appData, "nope") }),
      /No vault found/,
    );
  } finally {
    rmSync(appData, { recursive: true, force: true });
  }
});
