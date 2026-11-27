// src/components/ui/menuEntries.test.ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { compareNames } from "../../lib/utils";
import type { Folder } from "../../types";
import { folderChoiceEntries, revealEntries } from "./menuEntries";

const folder = (id: string, parentId: string | null = null): Folder => ({
  id,
  name: id,
  parentId,
  createdAt: "2026-01-01T00:00:00.000Z",
});
const byName = (a: Folder, b: Folder) => compareNames(a.name, b.name);
const rows = (entries: ReturnType<typeof folderChoiceEntries>) =>
  entries.map((e) =>
    typeof e === "object" && "onSelect" in e
      ? [e.label, e.indent ?? 0, e.checked, e.disabled]
      : e,
  );

describe("folderChoiceEntries", () => {
  const folders = [folder("b"), folder("a"), folder("a/x", "a")];

  test("lists no folder first, then the folders as a tree in the given order", () => {
    const entries = folderChoiceEntries({
      folders,
      compare: byName,
      rootLabel: "No folder",
      currentId: null,
      onPick: () => {},
    });
    expect(rows(entries)).toEqual([
      ["No folder", 0, true, true],
      ["a", 0, false, false],
      ["a/x", 1, false, false],
      ["b", 0, false, false],
    ]);
  });

  test("checks and switches off where the thing is now, and can switch off every row", () => {
    const entries = folderChoiceEntries({
      folders,
      compare: byName,
      rootLabel: "Top level",
      currentId: "a",
      disabled: true,
      onPick: () => {},
    });
    expect(rows(entries)).toEqual([
      ["Top level", 0, false, true],
      ["a", 0, true, true],
      ["a/x", 1, false, true],
      ["b", 0, false, true],
    ]);
  });

  test("leaves out the folders `skip` names and picks by id (null for none)", () => {
    const picked: (string | null)[] = [];
    const entries = folderChoiceEntries({
      folders,
      compare: byName,
      rootLabel: "Top level",
      currentId: "b",
      skip: (f) => f.id.startsWith("a"),
      onPick: (id) => picked.push(id),
    });
    expect(rows(entries).map((r) => (Array.isArray(r) ? r[0] : r))).toEqual([
      "Top level",
      "b",
    ]);
    for (const e of entries)
      if (typeof e === "object" && "onSelect" in e) e.onSelect();
    expect(picked).toEqual([null, "b"]);
  });
});

describe("revealEntries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test("offers Show in Explorer and Copy path, both off when asked", async () => {
    const entries = revealEntries(
      () => {},
      () => {},
      true,
    );
    expect(
      entries.map((e) =>
        typeof e === "object" && "onSelect" in e ? [e.label, e.disabled] : e,
      ),
    ).toEqual([
      ["Show in Explorer", true],
      ["Copy path", true],
    ]);
  });

  test("offers nothing on Android, whose notes no file manager shows", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 16)",
    });
    vi.resetModules();
    const { revealEntries: onAndroid } = await import("./menuEntries");
    expect(
      onAndroid(
        () => {},
        () => {},
      ),
    ).toEqual([]);
  });
});
