// src/lib/openLink.test.ts
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const opener = vi.hoisted(() => ({
  openUrl: vi.fn<(url: string) => Promise<void>>(),
}));
vi.mock("@tauri-apps/plugin-opener", () => opener);

const { openLink } = await import("./openLink");

beforeEach(() => {
  opener.openUrl.mockReset().mockResolvedValue(undefined);
});

test("web and mail links go to the default app", () => {
  for (const href of [
    "https://example.com/a?b=1",
    "HTTP://example.com",
    "mailto:me@example.com",
  ])
    openLink(href);
  assert.deepEqual(
    opener.openUrl.mock.calls.map((c) => c[0]),
    [
      "https://example.com/a?b=1",
      "HTTP://example.com",
      "mailto:me@example.com",
    ],
  );
});

test("anything else is ignored", () => {
  for (const href of [
    undefined,
    "",
    "file:///C:/secret.txt",
    "javascript:alert(1)",
    "notes/other.md",
    " https://example.com",
  ])
    openLink(href);
  assert.equal(opener.openUrl.mock.calls.length, 0);
});

test("a link the app cannot open is logged, not thrown", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  opener.openUrl.mockImplementation(() =>
    Promise.reject(new Error("no handler")),
  );
  openLink("https://example.com");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(error.mock.calls.length, 1);
  error.mockRestore();
});
