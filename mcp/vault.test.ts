// mcp/vault.test.ts
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { test } from "vitest";
import { joinPath } from "../src/lib/paths";
import { vaultSource } from "./vault";

// What a client passes when it never filled in the setting
const unfilled = (key: string) => `\${user_config.${key}}`;

/** A fake AppData folder holding Graphene's config; `config` is written as JSON, or left out when undefined. */
async function withConfig(
  config: unknown,
  run: (env: NodeJS.ProcessEnv, file: string) => Promise<void>,
) {
  const appData = mkdtempSync(joinPath(tmpdir(), "graphene-appdata-"));
  try {
    const dir = joinPath(appData, "com.graphene.app", "graphene");
    mkdirSync(dir, { recursive: true });
    const file = joinPath(dir, "config.json");
    if (config !== undefined) writeFileSync(file, JSON.stringify(config));
    await run({ APPDATA: appData }, file);
  } finally {
    rmSync(appData, { recursive: true, force: true });
  }
}

test("a flag or GRAPHENE_VAULT pins one vault, named after its folder; an unfilled value is ignored", async () => {
  const only = async (argv: string[], env: NodeJS.ProcessEnv) =>
    (await vaultSource(argv, env)()).vaults;
  assert.deepEqual(await only(["--vault", "C:\\notes"], {}), [
    { name: "notes", path: "C:/notes" },
  ]);
  assert.deepEqual(await only(["--vault=C:\\notes"], {}), [
    { name: "notes", path: "C:/notes" },
  ]);
  assert.deepEqual(await only([], { GRAPHENE_VAULT: "D:\\n" }), [
    { name: "n", path: "D:/n" },
  ]);
  assert.equal((await vaultSource(["--vault", "C:/x"], {})()).active, "x");

  await withConfig({ vaultPath: "E:\\vault" }, async (env) => {
    for (const value of ["", unfilled("vault")])
      assert.deepEqual(
        await only([], { ...env, GRAPHENE_VAULT: value }),
        [{ name: "vault", path: "E:/vault" }],
        value,
      );
  });
});

test("the old config, with one vaultPath, is one vault", async () => {
  await withConfig({ vaultPath: "E:\\Notes" }, async (env) => {
    assert.deepEqual(await vaultSource([], env)(), {
      vaults: [{ name: "Notes", path: "E:/Notes" }],
      active: "Notes",
    });
  });
});

test("the config lists the shared vaults and says which one is open", async () => {
  await withConfig(
    {
      active: "D:\\b",
      vaultPath: "D:\\b",
      vaults: [
        { path: "D:\\a", name: "Alpha", shared: true },
        { path: "D:\\b", name: "Beta", shared: true },
        { path: "D:\\c", name: "Private", shared: false },
      ],
    },
    async (env) => {
      assert.deepEqual(await vaultSource([], env)(), {
        vaults: [
          { name: "Alpha", path: "D:/a" },
          { name: "Beta", path: "D:/b" },
        ],
        active: "Beta",
      });
    },
  );
});

test("when the open vault is not shared, the first shared one stands in for it", async () => {
  await withConfig(
    {
      active: "D:/a",
      vaults: [
        { path: "D:/a", name: "Alpha", shared: false },
        { path: "D:/b", name: "Beta" },
      ],
    },
    async (env) => {
      assert.equal((await vaultSource([], env)()).active, "Beta");
    },
  );
});

test("a vault no longer shared drops out at the next call, without a restart", async () => {
  await withConfig(
    { vaults: [{ path: "D:/a" }, { path: "D:/b" }] },
    async (env, file) => {
      const source = vaultSource([], env);
      assert.equal((await source()).vaults.length, 2);
      writeFileSync(
        file,
        JSON.stringify({
          vaults: [{ path: "D:/a" }, { path: "D:/b", shared: false }],
        }),
      );
      assert.deepEqual(
        (await source()).vaults.map((v) => v.name),
        ["a"],
      );
    },
  );
});

test("a config that cannot be read for a moment keeps the last good list", async () => {
  await withConfig({ vaults: [{ path: "D:/a" }] }, async (env, file) => {
    const source = vaultSource([], env);
    assert.equal((await source()).vaults.length, 1);
    writeFileSync(file, '{"vaults": [{"pa'); // caught half way through a write
    assert.equal((await source()).vaults.length, 1);
    unlinkSync(file);
    assert.equal((await source()).vaults.length, 1);
  });
});

test("nothing is shared is an empty list, not an error", async () => {
  await withConfig(
    { vaults: [{ path: "D:/a", shared: false }] },
    async (env) => {
      assert.deepEqual(await vaultSource([], env)(), {
        vaults: [],
        active: null,
      });
    },
  );
});

test("no config, an unreadable one or one with no vaults at all says to open Graphene once", async () => {
  await withConfig(undefined, async (env) => {
    await assert.rejects(vaultSource([], env)(), /No vault found/);
  });
  await withConfig({}, async (env) => {
    await assert.rejects(vaultSource([], env)(), /No vault found/);
  });
  const appData = mkdtempSync(joinPath(tmpdir(), "graphene-appdata-"));
  try {
    await assert.rejects(
      vaultSource([], { APPDATA: joinPath(appData, "nope") })(),
      /No vault found/,
    );
  } finally {
    rmSync(appData, { recursive: true, force: true });
  }
});
