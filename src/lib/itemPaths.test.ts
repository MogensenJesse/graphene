// src/lib/itemPaths.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Item } from "../types";
import { itemFilePath, slugify } from "./itemPaths";

const note = (over: Partial<Item>): Item => ({
  id: "abc123",
  title: "Weekend to-do list",
  folderId: null,
  body: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

test("slugify keeps words and drops everything else", () => {
  assert.equal(slugify("Weekend to-do list!"), "weekend-to-do-list");
  assert.equal(slugify("  "), "untitled");
  assert.equal(slugify("a".repeat(80)).length, 50);
});

// The file name is a contract: the app and the MCP server must agree, or a rename leaves a stale copy behind
test("a note is named <slug>-<id>.md inside its folder", () => {
  assert.equal(
    itemFilePath("C:/vault", note({})),
    "C:/vault/weekend-to-do-list-abc123.md",
  );
  assert.equal(
    itemFilePath("C:/vault", note({ folderId: "Prompts/Agents" })),
    "C:/vault/Prompts/Agents/weekend-to-do-list-abc123.md",
  );
});
