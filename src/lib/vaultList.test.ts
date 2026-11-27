// src/lib/vaultList.test.ts
import { describe, expect, test } from "vitest";
import {
  addVault,
  checkNewVault,
  EMPTY_CONFIG,
  folderName,
  moveVault,
  nameTaken,
  parseVaultConfig,
  removeVault,
  renameVault,
  serializeVaultConfig,
  setActive,
  setShared,
  sharedVaults,
  type VaultConfig,
} from "./vaultList";

const vault = (path: string, name: string, shared = true) => ({
  path,
  name,
  shared,
});

const config = (
  vaults: ReturnType<typeof vault>[],
  active: string | null = vaults[0]?.path ?? null,
): VaultConfig => ({ active, vaults, extra: {} });

describe("parseVaultConfig", () => {
  test("the old one-folder file becomes one shared vault", () => {
    const parsed = parseVaultConfig({ vaultPath: "C:\\Users\\a\\Notes" });
    expect(parsed.vaults).toEqual([
      vault("C:\\Users\\a\\Notes", "Notes", true),
    ]);
    expect(parsed.active).toBe("C:\\Users\\a\\Notes");
  });

  test("nothing usable gives no vaults", () => {
    for (const raw of [null, "x", 5, [], {}, { vaultPath: 3 }, { vaults: 1 }])
      expect(parseVaultConfig(raw)).toEqual(EMPTY_CONFIG);
  });

  test("a damaged entry is dropped and the rest kept", () => {
    const parsed = parseVaultConfig({
      vaults: [null, 4, { name: "No path" }, { path: "  " }, { path: "D:/a" }],
    });
    expect(parsed.vaults).toEqual([vault("D:/a", "a")]);
  });

  test("sharing is on unless it was switched off", () => {
    const parsed = parseVaultConfig({
      vaults: [{ path: "D:/a" }, { path: "D:/b", shared: false }],
    });
    expect(parsed.vaults.map((v) => v.shared)).toEqual([true, false]);
  });

  test("the same folder written two ways is one vault", () => {
    const parsed = parseVaultConfig({
      vaults: [{ path: "D:\\Notes" }, { path: "d:/notes/" }],
    });
    expect(parsed.vaults).toHaveLength(1);
  });

  test("names are made unique, whatever their case", () => {
    const parsed = parseVaultConfig({
      vaults: [
        { path: "D:/x/Notes" },
        { path: "D:/y/notes" },
        { path: "D:/z", name: "NOTES" },
      ],
    });
    expect(parsed.vaults.map((v) => v.name)).toEqual([
      "Notes",
      "notes 2",
      "NOTES 3",
    ]);
  });

  test("the open vault is `active`, else the old vaultPath, else the first", () => {
    const vaults = [{ path: "D:/a" }, { path: "D:/b" }, { path: "D:/c" }];
    expect(parseVaultConfig({ vaults, active: "d:\\b" }).active).toBe("D:/b");
    expect(parseVaultConfig({ vaults, vaultPath: "D:/c" }).active).toBe("D:/c");
    expect(
      parseVaultConfig({ vaults, active: "D:/gone", vaultPath: "D:/gone" })
        .active,
    ).toBe("D:/a");
  });

  test("keys it does not know come back out when written", () => {
    const parsed = parseVaultConfig({ vaultPath: "D:/a", future: { a: 1 } });
    expect(serializeVaultConfig(parsed).future).toEqual({ a: 1 });
  });
});

describe("serializeVaultConfig", () => {
  test("round trips", () => {
    const original = config(
      [vault("D:/a", "A"), vault("D:/b", "B", false)],
      "D:/b",
    );
    const again = parseVaultConfig(
      JSON.parse(JSON.stringify(serializeVaultConfig(original))),
    );
    expect(again).toEqual(original);
  });

  test("vaultPath is the open vault when it is shared", () => {
    const out = serializeVaultConfig(
      config([vault("D:/a", "A"), vault("D:/b", "B")], "D:/b"),
    );
    expect(out.vaultPath).toBe("D:/b");
    expect(out.active).toBe("D:/b");
  });

  test("an older program is never handed a vault that is not shared", () => {
    const out = serializeVaultConfig(
      config([vault("D:/a", "A", false), vault("D:/b", "B")], "D:/a"),
    );
    expect(out.active).toBe("D:/a");
    expect(out.vaultPath).toBe("D:/b");
  });

  test("with nothing shared there is no vaultPath", () => {
    const out = serializeVaultConfig(config([vault("D:/a", "A", false)]));
    expect(out).not.toHaveProperty("vaultPath");
  });

  test("no vaults, no active", () => {
    expect(serializeVaultConfig(EMPTY_CONFIG)).toEqual({ vaults: [] });
  });
});

describe("adding a vault", () => {
  const base = config([vault("D:/Notes", "Notes")]);

  test("goes last, shared, and does not take over from the open one", () => {
    const result = addVault(base, "E:\\Work");
    if ("kind" in result) throw new Error("should have been added");
    expect(result.entry).toEqual(vault("E:\\Work", "Work", true));
    expect(result.config.vaults).toHaveLength(2);
    expect(result.config.active).toBe("D:/Notes");
  });

  test("the first vault becomes the open one", () => {
    const result = addVault(EMPTY_CONFIG, "D:/a");
    if ("kind" in result) throw new Error("should have been added");
    expect(result.config.active).toBe("D:/a");
  });

  test("a second folder with the same name gets a number", () => {
    const result = addVault(base, "E:/notes");
    if ("kind" in result) throw new Error("should have been added");
    expect(result.entry.name).toBe("notes 2");
  });

  test("the same folder is refused, however it is written", () => {
    expect(checkNewVault(base, "d:\\notes\\")?.kind).toBe("duplicate");
  });

  test("a folder inside a vault, or around one, is refused", () => {
    expect(checkNewVault(base, "D:/Notes/Sub")?.kind).toBe("inside");
    expect(checkNewVault(base, "D:/")?.kind).toBe("contains");
    expect(checkNewVault(base, "D:/Notes2")).toBeNull(); // a longer name is not a child
  });

  test("a bare drive is called Vault", () => {
    expect(folderName("D:\\")).toBe("Vault");
    expect(folderName("D:/a/b/")).toBe("b");
  });

  test("a given name is used instead of the folder's; a taken one gets a number", () => {
    const made = addVault(base, "E:/x1", "Work");
    if ("kind" in made) throw new Error("should have been added");
    expect(made.entry).toEqual(vault("E:/x1", "Work"));
    const again = addVault(made.config, "E:/x2", "work");
    if ("kind" in again) throw new Error("should have been added");
    expect(again.entry.name).toBe("work 2");
  });

  test("a name is taken whatever its case, and spaces around it", () => {
    expect(nameTaken(base.vaults, "  notes ")).toBe(true);
    expect(nameTaken(base.vaults, "Notes 2")).toBe(false);
  });
});

describe("changing the list", () => {
  const three = config(
    [vault("D:/a", "A"), vault("D:/b", "B"), vault("D:/c", "C", false)],
    "D:/b",
  );

  test("removing a vault that is not open keeps the open one", () => {
    const next = removeVault(three, "D:/c");
    expect(next.vaults.map((v) => v.name)).toEqual(["A", "B"]);
    expect(next.active).toBe("D:/b");
  });

  test("removing the open vault opens the first one left", () => {
    expect(removeVault(three, "d:/b").active).toBe("D:/a");
  });

  test("removing the last vault leaves none", () => {
    expect(removeVault(config([vault("D:/a", "A")]), "D:/a")).toEqual(
      EMPTY_CONFIG,
    );
  });

  test("renaming needs a name no other vault has", () => {
    expect(renameVault(three, "D:/a", " Work ")?.vaults[0].name).toBe("Work");
    expect(renameVault(three, "D:/a", "b")).toBeNull(); // B is taken, case aside
    expect(renameVault(three, "D:/a", "a")?.vaults[0].name).toBe("a"); // its own name, in other case
    expect(renameVault(three, "D:/a", "  ")).toBeNull();
  });

  test("moving swaps with the neighbour and stops at the ends", () => {
    expect(moveVault(three, "D:/b", -1).vaults.map((v) => v.name)).toEqual([
      "B",
      "A",
      "C",
    ]);
    expect(moveVault(three, "D:/a", -1)).toBe(three);
    expect(moveVault(three, "D:/c", 1)).toBe(three);
  });

  test("sharing and opening", () => {
    expect(sharedVaults(three).map((v) => v.name)).toEqual(["A", "B"]);
    expect(sharedVaults(setShared(three, "D:/c", true))).toHaveLength(3);
    expect(setActive(three, "d:/a").active).toBe("D:/a");
    expect(setActive(three, "D:/nope")).toBe(three);
  });
});
