// src/components/sidebar/trashLabel.test.ts
import { expect, test } from "vitest";
import { trashLabel } from "./trashLabel";

test("the Trash button says how many notes are in it", () => {
  expect(trashLabel(false, 0)).toBe("Trash, 0 notes");
  expect(trashLabel(false, 1)).toBe("Trash, 1 note");
  expect(trashLabel(false, 4)).toBe("Trash, 4 notes");
});

test("a vault that cannot be opened has no count", () => {
  expect(trashLabel(true, 4)).toBe("Trash");
});
