// src/lib/reportError.test.ts
import assert from "node:assert/strict";
import { test, vi } from "vitest";
import {
  type AppError,
  onError,
  reportError,
  reportNotice,
} from "./reportError";
import { VaultMissingError } from "./vaultRoot";

test("a reported error reaches every listener with a fresh id and its retry", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const seen: AppError[] = [];
  const off = onError((e) => seen.push(e));
  const retry = () => {};
  reportError("Could not save", new Error("disk full"), retry);
  reportError("Could not save again");
  assert.equal(seen.length, 2);
  assert.equal(seen[0].message, "Could not save");
  assert.equal(seen[0].retry, retry);
  assert.equal(seen[1].retry, undefined);
  assert.notEqual(seen[0].id, seen[1].id);
  off();
});

test("after unsubscribing a listener hears nothing, and a throwing one does not block the rest", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let heard = 0;
  const off = onError(() => {
    heard++;
  });
  const offBad = onError(() => {
    throw new Error("boom");
  });
  let last = 0;
  const offLast = onError(() => {
    last++;
  });
  reportError("one");
  assert.equal(heard, 1);
  assert.equal(last, 1);
  off();
  reportError("two");
  assert.equal(heard, 1);
  assert.equal(last, 2);
  offBad();
  offLast();
});

test("a missing vault folder is told in the toast, any other cause stays in the console, and a notice is not an error", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const seen: AppError[] = [];
  const off = onError((e) => seen.push(e));
  reportError('Could not save "Plan"', new VaultMissingError());
  reportError('Could not save "Plan"', new Error("disk full"));
  reportNotice("Restored to Work");
  off();
  assert.equal(
    seen[0].message,
    'Could not save "Plan": the vault folder is not there',
  );
  assert.equal(seen[1].message, 'Could not save "Plan"');
  assert.deepEqual(
    [seen[0].notice, seen[2].notice, seen[2].message, seen[2].retry],
    [undefined, true, "Restored to Work", undefined],
  );
});
