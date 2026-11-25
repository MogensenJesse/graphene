// src/lib/startVault.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { startVault } from "./startVault";
import { pathKey, type VaultConfig } from "./vaultList";

const vault = (path: string, name: string) => ({ path, name, shared: true });
const config = (active: string | null): VaultConfig => ({
  active,
  vaults: [vault("C:/a", "Work"), vault("C:/b", "Home"), vault("C:/c", "Old")],
  extra: {},
});
const gone = (...paths: string[]) => new Set(paths.map(pathKey));

test("the saved vault opens when its folder is there, and nothing is said", () => {
  const start = startVault(config("C:/b"), gone("C:/c"));
  assert.equal(start.config.active, "C:/b");
  assert.equal(start.fellBack, null);
});

test("a saved vault whose folder is missing falls back to the first one that is there, and says which", () => {
  const start = startVault(config("C:/a"), gone("C:/a"));
  assert.equal(start.config.active, "C:/b");
  assert.deepEqual(
    [start.fellBack?.wanted.name, start.fellBack?.opened.name],
    ["Work", "Home"],
  );
  // the first usable one is skipped over when it is gone too
  const skip = startVault(config("C:/a"), gone("C:/a", "C:/b"));
  assert.equal(skip.config.active, "C:/c");
  assert.equal(skip.fellBack?.opened.name, "Old");
});

test("with no folder at all the saved vault stays (VaultUnavailable explains) and there is no fall back to announce", () => {
  const start = startVault(config("C:/a"), gone("C:/a", "C:/b", "C:/c"));
  assert.equal(start.config.active, "C:/a");
  assert.equal(start.fellBack, null);
});

test("no saved vault, or one that is not on the list, opens the first one there without a notice", () => {
  assert.equal(startVault(config(null), gone()).config.active, "C:/a");
  const stale = startVault(config("C:/zzz"), gone("C:/a"));
  assert.equal(stale.config.active, "C:/b");
  assert.equal(stale.fellBack, null);
  const none = startVault({ active: null, vaults: [], extra: {} }, gone());
  assert.equal(none.config.active, null);
});

test("paths are compared the way the list does (case and slashes)", () => {
  const start = startVault(config("c:\\A"), gone("C:/a"));
  assert.equal(start.config.active, "C:/b");
  assert.equal(start.fellBack?.wanted.name, "Work");
});
