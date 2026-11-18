// src/lib/order.ts
// A chosen order for the notes of a folder and for sibling folders: each one may carry a rank (`order`).
// Ranked ones come first, ascending; the rest follow by name. Pure, see order.test.ts.
import type { Folder, Item } from "../types";
import { compareNames } from "./utils";

const STEP = 1024; // distance between ranks when a list is numbered
const MIN_GAP = 1e-6; // closer than this two ranks cannot take a third between them

interface Ranked {
  id: string;
  order?: number;
}

function manualBy<T extends { order?: number }>(name: (t: T) => string) {
  return (a: T, b: T): number => {
    const ra = a.order ?? Number.POSITIVE_INFINITY;
    const rb = b.order ?? Number.POSITIVE_INFINITY;
    return ra === rb ? compareNames(name(a), name(b)) : ra < rb ? -1 : 1;
  };
}

export const compareItemsManual = manualBy<Item>((i) => i.title);
export const compareFoldersManual = manualBy<Folder>((f) => f.name);

/**
 * The ranks to write so `movedId` lands next to `nearId` (before it, or after it when `after`) among
 * `siblings`: the notes (or folders) of one list, in the order they are shown. Usually that is one rank, the
 * middle between its new neighbours. When a neighbour has no rank yet, when there is no room left, or when
 * `renumber` is set (the list is shown by name or date, so its ranks mean nothing), every sibling is numbered
 * 1024, 2048, … in the new order, and only the ranks that differ come back. Empty when nothing would change.
 * `movedId` may come from another list: it is not among `siblings` then.
 */
export function placeNear(
  siblings: Ranked[],
  movedId: string,
  nearId: string,
  after: boolean,
  renumber = false,
): Record<string, number> {
  const rest = siblings.filter((s) => s.id !== movedId);
  const near = rest.findIndex((s) => s.id === nearId);
  if (near === -1) return {};
  const index = after ? near + 1 : near;
  if (siblings.findIndex((s) => s.id === movedId) === index) return {};

  const prev = index > 0 ? rest[index - 1] : null;
  const next = index < rest.length ? rest[index] : null;
  const prevUnranked = prev !== null && prev.order === undefined;
  const nextUnranked = next !== null && next.order === undefined;
  if (!renumber && !prevUnranked && !nextUnranked) {
    const lo = prev?.order;
    const hi = next?.order;
    if (lo === undefined || hi === undefined || hi - lo >= MIN_GAP) {
      const rank =
        lo === undefined
          ? hi === undefined
            ? STEP
            : hi - STEP
          : hi === undefined
            ? lo + STEP
            : (lo + hi) / 2;
      return { [movedId]: rank };
    }
  }

  const current = new Map(siblings.map((s) => [s.id, s.order]));
  const ordered = [
    ...rest.slice(0, index),
    { id: movedId },
    ...rest.slice(index),
  ];
  const ranks: Record<string, number> = {};
  ordered.forEach((s, i) => {
    const rank = (i + 1) * STEP;
    if (current.get(s.id) !== rank) ranks[s.id] = rank;
  });
  return ranks;
}
