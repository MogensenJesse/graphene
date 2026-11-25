// src/lib/hotPaths.bench.ts
// `npm run bench`: the code that runs on every keystroke, on generated input (nothing is read from disk), so the
// performance work on it is decided by numbers.
import { afterAll, test } from "vitest";
import type { Item } from "../types";
import { findFenceAt } from "./codeBlocks";
import { searchItems } from "./search";
import { lineCount, wordCount } from "./wordCount";

// ── Input ─────────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260101);
const int = (n: number) => Math.floor(rand() * n);
const pick = <T>(list: T[]): T => list[int(list.length)];

const WORDS =
  `the of and to a in is that for it with as on be at by this we from or an are will can not have more about when which
one all their there been if would who what out up so them some into time only new then other also our its should after before first
because over like see how each use two make well may way work need now these team plan ship note check review update decide owner
risk scope budget quarter customer feature release bug fix draft meeting follow agenda blocked waiting done later maybe urgent`.split(
    /\s+/,
  );
const TOPICS =
  "atlas billing onboarding pipeline roadmap latency invoices migration kubernetes postgres retro hiring budget parser cache analytics".split(
    " ",
  );
const FENCE = "`".repeat(3);
const words = (n: number) =>
  Array.from({ length: n }, () => pick(WORDS)).join(" ");
const sentence = () => `${words(6 + int(10))}.`;
const paragraph = () => Array.from({ length: 2 + int(4) }, sentence).join(" ");
const fenced = () =>
  `${FENCE}ts\n${Array.from({ length: 3 + int(10) }, () => `const ${pick(TOPICS)} = load(${int(100)});`).join("\n")}\n${FENCE}`;

// Pieces of markdown (about 15% of them a code block) that notes are made from
const POOL = Array.from({ length: 400 }, () =>
  int(100) < 15 ? fenced() : paragraph(),
);
const markdown = (size: number) => {
  const parts: string[] = [];
  for (let length = 0; length < size; ) {
    const part = pick(POOL);
    parts.push(part);
    length += part.length + 2;
  }
  return parts.join("\n\n");
};

/** Notes like the vault generator's: 2 to 8 KB, "atlas" in some titles, "zebrafish" in the text of 2%. */
function makeItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => {
    const body = markdown(2048 + int(6144));
    return {
      id: `id${i}`,
      title: `${pick(["Notes on", "Plan for", "Review of", "Draft"])} ${pick(TOPICS)} ${int(100)}`,
      folderId: int(10) === 0 ? null : `Folder ${int(50)}/Sub ${int(20)}`,
      body: int(50) === 0 ? `${body}\nzebrafish` : body,
      createdAt: new Date(1.7e12 - int(2e10)).toISOString(),
      updatedAt: new Date(1.7e12 + int(2e10)).toISOString(),
    };
  });
}

let sink = 0; // keeps the results alive, so nothing is optimised away

// Short runs: the cold search at 20 000 notes takes a few hundred ms per call
const RUN = { time: 300, iterations: 8, warmupTime: 100, warmupIterations: 2 };
const SLOW = { timeout: 120000 };

// ── searchItems (P9) ──────────────────────────────────────────────────────────

for (const count of [1000, 5000, 20000]) {
  const items = makeItems(count);
  // The first search after a load lowercases every note; the rest reuse that (see lowerCache in search.ts)
  searchItems(items, "warm up the cache");
  test(`searchItems, ${count} notes`, SLOW, async ({ bench }) => {
    await bench.compare(
      bench("empty query (the newest 50)", () => {
        sink += searchItems(items, "").length;
      }),
      // What Ctrl+K shows before anything is typed: the newest 12. The old palette built a result for every note and sorted them all
      bench("Ctrl+K with no query, before: sort every note, take 12", () => {
        sink += items
          .map((item) => ({ item, updatedAt: item.updatedAt }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 12).length;
      }),
      bench("Ctrl+K with no query, now: the newest 12 in one pass", () => {
        sink += searchItems(items, "", 12).length;
      }),
      bench("a word that is in many titles", () => {
        sink += searchItems(items, "atlas").length;
      }),
      bench("a word only in the text of a few", () => {
        sink += searchItems(items, "zebrafish").length;
      }),
      bench("two words, no match", () => {
        sink += searchItems(items, "qzxv wkjh").length;
      }),
      bench("operators: in:folder type:code -draft", () => {
        sink += searchItems(items, "in:sub type:code -draft").length;
      }),
      bench("cold: new note objects, nothing cached", () => {
        sink += searchItems(
          items.map((i) => ({ ...i })),
          "atlas",
        ).length;
      }),
      RUN,
    );
  });
}

// ── findFenceAt (P4) ──────────────────────────────────────────────────────────

for (const mb of [1, 5]) {
  const text = markdown(mb * 1024 * 1024);
  const crlf = text.replace(/\n/g, "\r\n");
  const inFirstFence = text.indexOf(FENCE) + 8;
  const lines = text.split("\n").length;
  test(`findFenceAt, ${mb} MB (${lines} lines)`, SLOW, async ({ bench }) => {
    await bench.compare(
      bench("caret outside a fence, at the end", () => {
        sink += findFenceAt(text, text.length - 1)?.langStart ?? 0;
      }),
      bench("caret outside a fence, near the start", () => {
        sink += findFenceAt(text, 5)?.langStart ?? 0;
      }),
      bench("caret in the first fence", () => {
        sink += findFenceAt(text, inFirstFence)?.langStart ?? 0;
      }),
      // What NoteEditor does with a text that came from a Windows file, once (before the first edit)
      bench("CRLF text: replace to LF, then the caret outside a fence", () => {
        sink += findFenceAt(crlf.replace(/\r\n/g, "\n"), text.length - 1)
          ? 1
          : 0;
      }),
      // ...and on every keystroke after that: no "\r", nothing to convert
      bench("LF text: look for a \\r, then the caret outside a fence", () => {
        const lf = text.includes("\r") ? text.replace(/\r\n/g, "\n") : text;
        sink += findFenceAt(lf, text.length - 1) ? 1 : 0;
      }),
      RUN,
    );
  });
}

// ── wordCount (P4) ────────────────────────────────────────────────────────────
// The editor runs it 300 ms after the last key, never on a keystroke: this is the pause it takes then.

for (const mb of [1, 5]) {
  const text = markdown(mb * 1024 * 1024);
  const code = `${FENCE}ts\n${text.replace(/`/g, "'")}\n${FENCE}`;
  test(`wordCount, ${mb} MB`, SLOW, async ({ bench }) => {
    await bench.compare(
      bench("wordCount of a note", () => {
        sink += wordCount(text);
      }),
      bench("lineCount of a code note", () => {
        sink += lineCount(code);
      }),
      RUN,
    );
  });
}

afterAll(() => {
  if (sink < 0) console.log(sink); // never true: it only reads `sink`, so the work above cannot be dropped
});
