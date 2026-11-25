// src/lib/perf.test.ts
import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { ipcCommand, markRows, perfMark, perfReport } from "./perf";

afterEach(() => {
  vi.unstubAllGlobals();
  performance.clearMarks();
});

test("each mark is timed from the first, from the one before and from the page load", () => {
  const rows = markRows([
    { name: "scan", startTime: 612.34 },
    { name: "main", startTime: 400 },
    { name: "paint", startTime: 1000.06 },
  ]);
  assert.deepEqual(rows, [
    { mark: "main", at_ms: 0, step_ms: 0, since_load_ms: 400 },
    { mark: "scan", at_ms: 212.3, step_ms: 212.3, since_load_ms: 612.3 },
    { mark: "paint", at_ms: 600.1, step_ms: 387.7, since_load_ms: 1000.1 },
  ]);
  assert.deepEqual(markRows([]), []);
});

test("the command is read from a Tauri IPC request, and nothing else counts", () => {
  assert.equal(
    ipcCommand("http://ipc.localhost/plugin%3Afs%7Cread_text_file"),
    "plugin:fs|read_text_file",
  );
  assert.equal(
    ipcCommand("ipc://localhost/plugin%3Afs%7Cexists?x=1"),
    "plugin:fs|exists",
  );
  assert.equal(ipcCommand("http://tauri.localhost/assets/index.js"), null);
  assert.equal(ipcCommand("http://ipc.localhost/%E0%A4%A"), "%E0%A4%A");
});

test("it records nothing unless the preference is on, and never throws without storage", () => {
  perfMark("no storage"); // localStorage does not exist in node
  vi.stubGlobal("localStorage", { getItem: () => null });
  perfMark("off");
  vi.stubGlobal("localStorage", { getItem: () => "1" });
  perfMark("on");
  perfMark("on");
  const names = performance.getEntriesByType("mark").map((m) => m.name);
  assert.deepEqual(names, ["on"]); // and the second mark of a name changed nothing

  const table = vi.spyOn(console, "table").mockImplementation(() => {});
  perfReport();
  assert.equal(table.mock.calls.length, 1);
  assert.deepEqual(
    (table.mock.calls[0][0] as { mark: string }[]).map((r) => r.mark),
    ["on"],
  );
  table.mockRestore();
});

test("renders are counted per component, and only when the preference was on when the module loaded", async () => {
  vi.resetModules();
  const off = await import("./perf"); // no localStorage in node: off
  off.perfRender("ItemRow");
  assert.deepEqual(off.perfRenders(), {});

  vi.resetModules();
  vi.stubGlobal("localStorage", { getItem: () => "1" });
  const on = await import("./perf");
  on.perfRender("ItemRow");
  on.perfRender("ItemRow");
  on.perfRender("Sidebar");
  assert.deepEqual(on.perfRenders(), { ItemRow: 2, Sidebar: 1 });
  // reset hands back what it clears: call it before an action, read it after
  assert.deepEqual(on.perfRenders(true), { ItemRow: 2, Sidebar: 1 });
  assert.deepEqual(on.perfRenders(), {});

  on.perfRender("ItemRow");
  const table = vi.spyOn(console, "table").mockImplementation(() => {});
  on.perfReport();
  const printed = table.mock.calls.map((c) => c[0] as { component?: string }[]);
  assert.deepEqual(printed[printed.length - 1], [
    { component: "ItemRow", renders: 1 },
  ]);
  table.mockRestore();
  vi.resetModules();
});
