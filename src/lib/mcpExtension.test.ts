// src/lib/mcpExtension.test.ts
import { expect, test } from "vitest";
import { extensionIsOld } from "./mcpExtension";

test("the extension is old only when Graphene is newer than the version it was added at", () => {
  expect(extensionIsOld(null, "1.5.0")).toBe(false); // never added from here
  expect(extensionIsOld("1.4.0", "1.4.0")).toBe(false);
  expect(extensionIsOld("1.4.0", "1.4.1")).toBe(true);
  expect(extensionIsOld("1.4.0", "1.10.0")).toBe(true); // numbers, not text
  expect(extensionIsOld("1.5.0", "1.4.0")).toBe(false); // a downgrade
  expect(extensionIsOld("1.4.0", "")).toBe(false); // the version has not loaded yet
});
