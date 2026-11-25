// src/lib/writeQueue.ts
// File writes in the order they were asked for, one after the other under the same key (a note's id), so a slow
// write never lands over a newer one. A failure is the job's outcome, never a rejection, and does not stop the next job.

export type Outcome<T> = { value: T } | { error: unknown };

export function createWriteQueue() {
  const tails = new Map<string, Promise<Outcome<unknown>>>();

  /** Runs `job` after the earlier jobs under `key`. */
  function run<T>(key: string, job: () => Promise<T>): Promise<Outcome<T>> {
    const before: Promise<unknown> = tails.get(key) ?? Promise.resolve();
    const done: Promise<Outcome<T>> = before.then(job).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    tails.set(key, done);
    done.then(() => {
      if (tails.get(key) === done) tails.delete(key);
    });
    return done;
  }

  /** The outcome of the newest job under `key`, or undefined when none is waiting or running. */
  const newest = (key: string) => tails.get(key);

  /** Resolves once every job started so far has finished. */
  const settled = async () => {
    await Promise.all(tails.values());
  };

  return { run, newest, settled };
}
