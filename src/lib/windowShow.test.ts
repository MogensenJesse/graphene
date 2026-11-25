// src/lib/windowShow.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";

const show = vi.fn<() => Promise<void>>();
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ show }),
}));

let frame: (() => void) | null;

// The module remembers that it was called, so each test loads a fresh copy
const load = async () => (await import("./windowShow")).showWindow;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  show.mockReset().mockResolvedValue(undefined);
  frame = null;
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    frame = cb;
    return 1;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("the window is shown after the next frame, once, however often it is asked", async () => {
  const showWindow = await load();
  showWindow();
  showWindow();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(show.mock.calls.length, 0, "not before a frame");
  frame?.();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(show.mock.calls.length, 1);
  showWindow();
  await vi.advanceTimersByTimeAsync(1000);
  assert.equal(show.mock.calls.length, 1, "a later call does nothing");
});

test("a webview that runs no frames while hidden still shows the window, after FRAME_WAIT_MS", async () => {
  const showWindow = await load();
  showWindow();
  await vi.advanceTimersByTimeAsync(49);
  assert.equal(show.mock.calls.length, 0);
  await vi.advanceTimersByTimeAsync(1);
  assert.equal(show.mock.calls.length, 1);
});

test("a window that cannot be shown is logged, not thrown", async () => {
  show.mockRejectedValue(new Error("no permission"));
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const showWindow = await load();
  showWindow();
  await vi.advanceTimersByTimeAsync(100);
  assert.equal(error.mock.calls.length, 1);
  error.mockRestore();
});
