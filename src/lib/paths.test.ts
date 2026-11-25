// src/lib/paths.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { extOf, fileName, joinPath, nativePath, relativePath } from "./paths";

const BACK = "\\";

test("joinPath writes one spelling: forward slashes, no doubled or trailing slash", () => {
  assert.equal(
    joinPath(`C:${BACK}Users${BACK}me${BACK}vault`, "Work", "a.md"),
    "C:/Users/me/vault/Work/a.md",
  );
  assert.equal(joinPath("/v/", "/x//y/"), "/v/x/y");
});

test("relativePath, fileName and extOf", () => {
  assert.equal(
    relativePath("D:/v", `D:${BACK}v${BACK}Work${BACK}Plans`),
    "Work/Plans",
  );
  assert.equal(relativePath("D:/v", "E:/elsewhere"), "E:/elsewhere");
  assert.equal(fileName("D:/v/Work/a.md"), "a.md");
  assert.equal(extOf("Photo.PNG"), "png");
  assert.equal(extOf("README"), "");
});

test("nativePath gives a Windows path its backslashes back and leaves other paths alone", () => {
  assert.equal(
    nativePath("D:/notes/Work/plan-n1.md"),
    `D:${BACK}notes${BACK}Work${BACK}plan-n1.md`,
  );
  assert.equal(nativePath("c:/v"), `c:${BACK}v`);
  assert.equal(nativePath("/home/me/notes/a.md"), "/home/me/notes/a.md");
  assert.equal(
    nativePath(joinPath(`D:${BACK}notes`, "Work")),
    `D:${BACK}notes${BACK}Work`,
  );
});
