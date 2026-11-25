// src/hooks/useBodies.ts
// The texts of the notes the scan listed without them (lib/storage loadVault, `Item.unloaded`). The sidebar paints from the
// metadata; this hook brings the texts in afterwards, and at once for a note that is needed now.
//   - Background: after each scan the notes still `unloaded` are read in batches (lib/vaultScan batchSize), one readNotes call at
//     a time, and each batch is applied with ONE state update, in a transition so typing and clicks stay ahead of the re-render. A
//     read that failed is tried once more; what still fails stays unloaded and is reported once, not per note.
//   - Now: `loadBodies(ids)` reads those notes straight away (a call of its own, so it does not wait for the background batch). A
//     note that is open, renamed, moved or trashed goes through it first (see useItems and App).
//   - Never over something newer: applyBodies only fills a note that is still `unloaded`, so a note typed in, saved or changed
//     since the scan keeps its text (an unloaded note cannot have been: nothing opens or writes one, see storage writeItem).
//   - A vault switch remounts the owner (`key={vaultPath}`), which stops the pass: a batch that lands late is dropped.
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useState,
} from "react";
import { applyBodies } from "../lib/mergeScan";
import { perfMark } from "../lib/perf";
import { reportError } from "../lib/reportError";
import { batchSize, type FileStamp, readBodies } from "../lib/vaultScan";
import type { Item } from "../types";

interface BodiesOptions {
  vaultPath: string;
  itemsRef: RefObject<Item[]>;
  setItems: Dispatch<SetStateAction<Item[]>>;
  /** The file of each note by id, from the scan. */
  files: ReadonlyMap<string, FileStamp>;
  /** The notes whose newest write failed: their text in memory is the user's, so a text read from disk never replaces it. */
  unsaved: ReadonlyMap<string, unknown>;
  /** Goes up each time a scan is adopted; the background pass starts over on it. */
  scanId: number;
}

export function useBodies({
  vaultPath,
  itemsRef,
  setItems,
  files,
  unsaved,
  scanId,
}: BodiesOptions) {
  // True from a scan until the background pass is over (what Ctrl+K shows as "Indexing")
  const [indexing, setIndexing] = useState(false);

  /** Reads the notes among `ids` that are not loaded yet, ahead of the background pass. Rejects when one cannot be read. */
  const loadBodies = useCallback(
    async (ids: string[]): Promise<void> => {
      const wanted = new Set(ids);
      const waiting = itemsRef.current
        .filter((item) => item.unloaded && wanted.has(item.id))
        .map((item) => item.id);
      if (waiting.length === 0) return;
      const { bodies, errors } = await readBodies(vaultPath, waiting, files);
      if (bodies.size > 0)
        setItems((prev) => applyBodies(prev, bodies, new Set(unsaved.keys())));
      const failed = errors.values().next();
      if (!failed.done) throw new Error(failed.value);
    },
    [vaultPath, itemsRef, setItems, files, unsaved],
  );

  useEffect(() => {
    if (scanId === 0) return;
    let stopped = false;

    // One pass over `ids`, a batch per call; resolves with the notes that could not be read, by id with the reason
    const pass = async (ids: string[]): Promise<Map<string, string>> => {
      const failed = new Map<string, string>();
      const size = batchSize(ids.length);
      for (let at = 0; at < ids.length && !stopped; at += size) {
        const wanted = new Set(ids.slice(at, at + size));
        // A note that was opened or written meanwhile is loaded already
        const waiting = itemsRef.current
          .filter((item) => item.unloaded && wanted.has(item.id))
          .map((item) => item.id);
        const { bodies, errors } = await readBodies(
          vaultPath,
          waiting,
          files,
          size,
        );
        if (stopped) break;
        if (bodies.size > 0)
          startTransition(() =>
            setItems((prev) =>
              applyBodies(prev, bodies, new Set(unsaved.keys())),
            ),
          );
        for (const [id, why] of errors) failed.set(id, why);
      }
      return failed;
    };

    // One message for all of them, with a Retry that runs the pass over just those
    const report = (failed: Map<string, string>) => {
      const [[, why]] = failed;
      const count = failed.size;
      reportError(
        `Could not read ${count} ${count === 1 ? "note" : "notes"}. They cannot be opened or searched until they can be read`,
        why,
        async () => {
          const again = await pass([...failed.keys()]);
          if (!stopped && again.size > 0) report(again);
        },
      );
    };

    (async () => {
      const waiting = itemsRef.current
        .filter((item) => item.unloaded)
        .map((item) => item.id);
      setIndexing(waiting.length > 0);
      if (waiting.length === 0) return perfMark("bodies-read");
      let failed = await pass(waiting);
      if (failed.size > 0 && !stopped) failed = await pass([...failed.keys()]);
      if (stopped) return;
      setIndexing(false);
      perfMark("bodies-read");
      if (failed.size > 0) report(failed);
    })().catch((err) => {
      if (!stopped) console.error("[useBodies]", err);
    });

    return () => {
      stopped = true;
    };
  }, [scanId, vaultPath, itemsRef, setItems, files, unsaved]);

  return { loadBodies, indexing };
}
