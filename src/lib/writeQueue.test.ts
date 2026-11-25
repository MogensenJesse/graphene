// src/lib/writeQueue.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { createWriteQueue } from "./writeQueue";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("jobs under one key run in the order they were asked for, even when an earlier one is slower", async () => {
  const q = createWriteQueue();
  const log: string[] = [];
  const a = q.run("note", async () => {
    await wait(20);
    log.push("a");
  });
  const b = q.run("note", async () => {
    log.push("b");
  });
  await Promise.all([a, b]);
  assert.deepEqual(log, ["a", "b"]);
});

test("a failed job is its outcome, and the next job still runs", async () => {
  const q = createWriteQueue();
  const failed = q.run("note", async () => {
    throw new Error("disk full");
  });
  const next = q.run("note", async () => 7);
  const out = await failed;
  assert.ok("error" in out && (out.error as Error).message === "disk full");
  assert.deepEqual(await next, { value: 7 });
});

test("different keys do not wait for each other", async () => {
  const q = createWriteQueue();
  const log: string[] = [];
  q.run("slow", async () => {
    await wait(20);
    log.push("slow");
  });
  await q.run("quick", async () => {
    log.push("quick");
  });
  assert.deepEqual(log, ["quick"]);
  await q.settled();
  assert.deepEqual(log, ["quick", "slow"]);
});

test("settled waits for every job, and the key is free afterwards", async () => {
  const q = createWriteQueue();
  q.run("a", () => wait(10));
  q.run("b", () => Promise.reject(new Error("no")));
  assert.ok(q.newest("a"));
  await q.settled();
  await wait(0);
  assert.equal(q.newest("a"), undefined);
  assert.equal(q.newest("b"), undefined);
});
