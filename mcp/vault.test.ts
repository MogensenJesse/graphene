// mcp/vault.test.ts
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vitest";
import { serializeItem } from "../src/lib/fileFormat";
import { joinPath, relativePath } from "../src/lib/paths";
import { itemKind } from "../src/lib/utils";
import type { Item } from "../src/types";
import { scanVault, vaultSource, writeNote } from "./vault";

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

const note = (id: string, body: string): Item => ({
  id,
  title: "Plan",
  folderId: null,
  body,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

/** A scratch vault folder, removed afterwards. */
async function withVault(run: (vault: string) => Promise<void>) {
  const vault = mkdtempSync(joinPath(tmpdir(), "graphene-vault-"));
  try {
    await run(joinPath(vault));
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
}

test("writeNote replaces a note whole and leaves no temp file", async () => {
  await withVault(async (vault) => {
    const path = joinPath(vault, "a", "plan-n1.md");
    await writeNote(vault, path, note("n1", "first"));
    await writeNote(vault, path, note("n1", "second"));
    assert.deepEqual(readdirSync(joinPath(vault, "a")), ["plan-n1.md"]);
    assert.match(readFileSync(path, "utf8"), /second/);
  });
});

test("a write that fails rejects and leaves no temp file behind", async () => {
  await withVault(async (vault) => {
    const path = joinPath(vault, "plan-n1.md");
    mkdirSync(path); // a folder where the note should go: the rename cannot succeed
    await assert.rejects(writeNote(vault, path, note("n1", "x")));
    assert.deepEqual(readdirSync(vault), ["plan-n1.md"]);
  });
});

test("the scan never reports a leftover temp file or a dot file as a note", async () => {
  await withVault(async (vault) => {
    await writeNote(vault, joinPath(vault, "plan-n1.md"), note("n1", "real"));
    const ghost = serializeItem(note("n2", "half written"));
    writeFileSync(joinPath(vault, ".plan-n2.md.tmp"), ghost); // a crash between the write and the rename
    writeFileSync(joinPath(vault, ".plan-n3.md"), ghost);
    const { notes } = await scanVault(vault);
    assert.deepEqual(
      notes.map((n) => n.item.id),
      ["n1"],
    );
  });
});

test("the scan of the fixture vault finds what the shared fixtures expect", async () => {
  // The same files and expected values as src/lib/fileFormat.test.ts and the Rust scan (src-tauri/tests/vault_scan.rs)
  const fixtures = joinPath(resolve(import.meta.dirname, "../fixtures"));
  const expected = JSON.parse(
    readFileSync(`${fixtures}/vault.expected.json`, "utf8"),
  );
  const { notes, folders } = await scanVault(`${fixtures}/vault`);
  // This scan lists in readdir order and Rust in sorted order, so what must match is the set
  const byPath = (a: { path: string }, b: { path: string }) =>
    a.path < b.path ? -1 : 1;
  const got = notes
    .map(({ item, path }) => ({
      item,
      path: relativePath(`${fixtures}/vault`, path),
    }))
    .sort(byPath);
  const want = [...expected.notes].sort(byPath);
  assert.deepEqual(
    got.map((n) => n.path),
    want.map((n) => n.path),
  );
  got.forEach(({ item }, i) => {
    const w = want[i];
    assert.deepEqual(
      { ...item, createdAt: "", updatedAt: "", kind: itemKind(item) },
      {
        id: w.id,
        title: w.title,
        folderId: w.folderId,
        body: w.body,
        ...(w.order === undefined ? {} : { order: w.order }),
        createdAt: "",
        updatedAt: "",
        kind: w.kind,
      },
      w.path,
    );
    // A missing date is the time of the parse here and null in the Rust scan
    for (const key of ["createdAt", "updatedAt"] as const)
      if (w[key] !== null) assert.equal(item[key], w[key], w.path);
  });
  assert.deepEqual(
    [...folders].sort(),
    expected.folders.map((f: { id: string }) => f.id).sort(),
  );
});

test("a note is not written into a vault folder that is not there, and the folder is not made again", async () => {
  await withVault(async (vault) => {
    const gone = joinPath(vault, "renamed-away");
    const path = joinPath(gone, "plan-n1.md");
    await assert.rejects(
      writeNote(gone, path, note("n1", "x")),
      /the vault folder is not there/,
    );
    // Not in a subfolder either: nothing below the missing vault is made
    await assert.rejects(
      writeNote(gone, joinPath(gone, "a", "b", "plan-n1.md"), note("n1", "x")),
      /the vault folder is not there/,
    );
    assert.equal(existsSync(gone), false);
    // A file where the vault folder should be is no folder either
    const file = joinPath(vault, "file.txt");
    writeFileSync(file, "x");
    await assert.rejects(
      writeNote(file, joinPath(file, "plan-n1.md"), note("n1", "x")),
      /the vault folder is not there/,
    );
  });
});

test("the folders below a vault that is there are still made", async () => {
  await withVault(async (vault) => {
    const path = joinPath(vault, "a", "b", "plan-n1.md");
    await writeNote(vault, path, note("n1", "deep"));
    assert.match(readFileSync(path, "utf8"), /deep/);
  });
});
