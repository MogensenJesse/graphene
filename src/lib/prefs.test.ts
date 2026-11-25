// src/lib/prefs.test.ts
import { afterEach, expect, test, vi } from "vitest";

function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  return data;
}

// The collapsed folders are read once per page load; a fresh import is a restart
async function startApp() {
  vi.resetModules();
  return import("./prefs");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("a folder collapsed in one vault is still open in another", async () => {
  stubStorage();
  const prefs = await startApp();
  prefs.setFolderCollapsed("D:/a", "Docs", true);
  expect(prefs.isFolderCollapsed("D:/a", "Docs")).toBe(true);
  expect(prefs.isFolderCollapsed("D:/b", "Docs")).toBe(false);
});

test("the same vault written another way is the same vault", async () => {
  stubStorage();
  const prefs = await startApp();
  prefs.setFolderCollapsed("D:\\Notes", "Docs", true);
  expect(prefs.isFolderCollapsed("d:/notes/", "Docs")).toBe(true);
});

test("what was collapsed is still collapsed after a restart", async () => {
  stubStorage();
  const first = await startApp();
  first.setFolderCollapsed("D:/a", "Docs", true);
  first.setFolderCollapsed("D:/a", "Docs", false);
  first.setFolderCollapsed("D:/a", "Work", true);
  const second = await startApp();
  expect(second.isFolderCollapsed("D:/a", "Docs")).toBe(false);
  expect(second.isFolderCollapsed("D:/a", "Work")).toBe(true);
});

test("the list from before there were several vaults goes to the first vault only", async () => {
  const data = stubStorage({ "graphene.collapsed": '["Docs"]' });
  const prefs = await startApp();
  expect(prefs.isFolderCollapsed("D:/first", "Docs")).toBe(true);
  expect(prefs.isFolderCollapsed("D:/second", "Docs")).toBe(false);
  expect(data.has("graphene.collapsed")).toBe(false);
});

test("a damaged saved value means nothing is collapsed", async () => {
  stubStorage({
    "graphene.collapsedByVault": "{oops",
    "graphene.collapsed": "also not json",
  });
  const prefs = await startApp();
  expect(prefs.isFolderCollapsed("D:/a", "Docs")).toBe(false);
});

test("without storage nothing breaks", async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  });
  const prefs = await startApp();
  prefs.setFolderCollapsed("D:/a", "Docs", true);
  expect(prefs.isFolderCollapsed("D:/a", "Docs")).toBe(true); // for this session
});

test("a row that listens is told when a folder opens or closes, and not when the change is silent", async () => {
  stubStorage();
  const prefs = await startApp();
  const seen: boolean[] = [];
  const stop = prefs.subscribeCollapsed(() =>
    seen.push(prefs.isFolderCollapsed("D:/a", "Docs")),
  );
  prefs.setFolderCollapsed("D:/a", "Docs", true);
  prefs.setFolderCollapsed("D:/a", "Docs", false, false);
  prefs.setFolderCollapsed("D:/a", "Docs", true);
  stop();
  prefs.setFolderCollapsed("D:/a", "Docs", false);
  expect(seen).toEqual([true, true]);
});
