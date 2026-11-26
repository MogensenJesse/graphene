// src/lib/vault.test.ts
// loadVaultConfig over a stand-in for the Rust command `boot_config` (src-tauri/src/boot.rs, tested in src-tauri/tests/boot_config.rs).
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { EMPTY_CONFIG, pathKey } from "./vaultList";

const tauri = vi.hoisted(() => ({
  invoke: vi.fn<(command: string) => Promise<unknown>>(),
  writeTextFile: vi.fn<(path: string, text: string) => Promise<void>>(),
  fsCalls: vi.fn(),
  appDataDir: vi.fn<() => Promise<string>>(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: tauri.appDataDir,
  join: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: 14 },
  // The three calls loadVaultConfig used to make; it must not make them any more
  exists: tauri.fsCalls,
  readTextFile: tauri.fsCalls,
  mkdir: vi.fn(),
  rename: vi.fn(),
  writeTextFile: tauri.writeTextFile,
}));

const { loadVaultConfig, withPrivateVault } = await import("./vault");

const config = {
  active: "D:/Notes",
  vaultPath: "D:/Notes",
  vaults: [
    { path: "D:/Notes", name: "Notes", shared: true },
    { path: "E:\\Work", name: "Work", shared: false },
  ],
};

beforeEach(() => {
  tauri.invoke.mockReset();
  tauri.writeTextFile.mockReset().mockResolvedValue(undefined);
  tauri.fsCalls.mockReset();
  tauri.appDataDir.mockReset().mockResolvedValue("/data/app");
});

test("Android's first start makes the vault in the app's own storage, opens it and saves the list", async () => {
  const made = await withPrivateVault(EMPTY_CONFIG);
  assert.deepEqual(
    made.vaults.map((v) => [v.path, v.name]),
    [["/data/app/Notes", "Notes"]],
  );
  assert.equal(made.active, "/data/app/Notes");
  assert.equal(tauri.writeTextFile.mock.calls.length, 1);
});

test("when the vault cannot be made the list stays as it was", async () => {
  tauri.appDataDir.mockRejectedValue(new Error("no such folder"));
  const made = await withPrivateVault(EMPTY_CONFIG);
  assert.equal(made, EMPTY_CONFIG);
  assert.equal(tauri.writeTextFile.mock.calls.length, 0);
});

test("the whole start is one call to Rust, and no fs plugin call", async () => {
  tauri.invoke.mockResolvedValue({
    text: JSON.stringify(config),
    exists: { "D:/Notes": true, "E:\\Work": true },
  });
  const loaded = await loadVaultConfig();
  assert.deepEqual(tauri.invoke.mock.calls, [["boot_config"]]);
  assert.equal(tauri.fsCalls.mock.calls.length, 0);
  assert.equal(loaded.corrupt, false);
  assert.deepEqual(
    loaded.config.vaults.map((v) => v.name),
    ["Notes", "Work"],
  );
  assert.equal(loaded.config.active, "D:/Notes");
  assert.equal(loaded.missing.size, 0);
});

test("a folder Rust says is not there, or did not mention, is missing; the key is the pathKey", async () => {
  tauri.invoke.mockResolvedValue({
    text: JSON.stringify(config),
    exists: { "D:/Notes": false },
  });
  const { missing } = await loadVaultConfig();
  assert.deepEqual(
    [...missing].sort(),
    [pathKey("D:/Notes"), pathKey("E:\\Work")].sort(),
  );
});

test("no file is the first run: an empty list, not corrupt", async () => {
  tauri.invoke.mockResolvedValue({ text: null, exists: {} });
  const loaded = await loadVaultConfig();
  assert.deepEqual(loaded.config.vaults, []);
  assert.equal(loaded.config.active, null);
  assert.equal(loaded.corrupt, false);
  assert.equal(tauri.writeTextFile.mock.calls.length, 0);
});

test("the old { vaultPath } file is one shared vault", async () => {
  tauri.invoke.mockResolvedValue({
    text: JSON.stringify({ vaultPath: "D:/Old" }),
    exists: { "D:/Old": true },
  });
  const loaded = await loadVaultConfig();
  assert.equal(loaded.config.vaults.length, 1);
  assert.equal(loaded.config.vaults[0].shared, true);
  assert.equal(loaded.config.active, "D:/Old");
  assert.equal(loaded.missing.size, 0);
});

test("text that does not parse is copied to config.json.bak and reported", async () => {
  for (const text of ["{ not json", "", "[1, 2]", "null"]) {
    tauri.writeTextFile.mockClear();
    tauri.invoke.mockResolvedValue({ text, exists: {} });
    const loaded = await loadVaultConfig();
    assert.equal(loaded.corrupt, true, `text ${JSON.stringify(text)}`);
    assert.deepEqual(loaded.config.vaults, []);
    assert.deepEqual(tauri.writeTextFile.mock.calls, [
      ["graphene/config.json.bak", text, { baseDir: 14 }],
    ]);
  }
});

test("a file Rust could not read is reported, not taken for the first run, and nothing is copied", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  tauri.invoke.mockRejectedValue(
    "config.json: stream did not contain valid UTF-8",
  );
  const loaded = await loadVaultConfig();
  assert.equal(loaded.corrupt, true);
  assert.deepEqual(loaded.config.vaults, []);
  assert.equal(tauri.writeTextFile.mock.calls.length, 0);
  error.mockRestore();
});

test("a backup that cannot be written still reports the file", async () => {
  tauri.invoke.mockResolvedValue({ text: "{", exists: {} });
  tauri.writeTextFile.mockRejectedValue(new Error("disk full"));
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const loaded = await loadVaultConfig();
  assert.equal(loaded.corrupt, true);
  error.mockRestore();
});
