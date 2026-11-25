// src/lib/codeWrap.test.ts
import { afterEach, expect, test, vi } from "vitest";

function stubBrowser(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  const dataset: Record<string, string> = {};
  vi.stubGlobal("document", { documentElement: { dataset } });
  return { data, dataset };
}

// The choice is read once per page load; a fresh import is a restart
async function startApp() {
  vi.resetModules();
  return import("./codeWrap");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("only a saved off turns wrapping off", async () => {
  const { parseCodeWrap } = await startApp();
  expect(parseCodeWrap(null)).toBe("on");
  expect(parseCodeWrap("on")).toBe("on");
  expect(parseCodeWrap("nonsense")).toBe("on");
  expect(parseCodeWrap("off")).toBe("off");
});

test("code wraps until the user says otherwise, and the choice is kept", async () => {
  const { data, dataset } = stubBrowser();
  let wrap = await startApp();
  expect(wrap.getCodeWrap()).toBe("on");
  wrap.toggleCodeWrap();
  expect(wrap.getCodeWrap()).toBe("off");
  expect(data.get("graphene.codeWrap")).toBe("off");
  expect(dataset.codeWrap).toBe("off");

  wrap = await startApp(); // a restart
  expect(wrap.getCodeWrap()).toBe("off");
  wrap.applyCodeWrap();
  expect(dataset.codeWrap).toBe("off");
  wrap.toggleCodeWrap();
  expect(wrap.getCodeWrap()).toBe("on");
  expect(data.get("graphene.codeWrap")).toBe("on");
});

test("a change reaches everything that subscribed, until it unsubscribes", async () => {
  stubBrowser();
  const wrap = await startApp();
  const seen: string[] = [];
  const off = wrap.subscribeCodeWrap(() => seen.push(wrap.getCodeWrap()));
  wrap.setCodeWrap("off");
  wrap.setCodeWrap("on");
  off();
  wrap.setCodeWrap("off");
  expect(seen).toEqual(["off", "on"]);
});
