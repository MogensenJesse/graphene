// scripts/gen-synthetic-vault.mjs
// Writes a synthetic Graphene vault (notes in a folder tree, a trash, a few huge notes, tasks) so startup and the hot
// paths can be measured on a known size (docs/plans/01-audit-fixes.md, WP0). Plain Node, no dependencies, the same output
// on every run (a seeded generator), except that task due dates and My Day are relative to the day it is run.
//
//   node scripts/gen-synthetic-vault.mjs --out <dir> --preset 1k|5k|20k|50k
//   options: --notes <n> (instead of a preset; the total in the tree, huge ones included), --big <count> (3: notes of
//            1 to 5 MB), --trash <n> (500), --tasks <n> (2000), --force (replace a vault this script made earlier)
//
// The format is the app's: src/lib/fileFormat.ts (frontmatter), src/lib/itemPaths.ts (file names), src/lib/taskStore.ts and
// src/lib/taskFiles.ts (.tasks). Never point --out into the repo or at a vault you care about.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PRESETS = { "1k": 1000, "5k": 5000, "20k": 20000, "50k": 50000 };
const MARKER = ".synthetic-vault.json"; // a dot file: the app's scan ignores it, and --force only clears dirs that have it
const SEED = 20260101;
const NOW = Date.UTC(2026, 0, 1); // dates in the notes are spread back from here, so they do not change between runs
const DAY = 86400000;
const NOTES_PER_FOLDER = 20;
const MAX_DEPTH = 4;
const MIN_BODY = 2 * 1024;
const MAX_BODY = 8 * 1024;
const MB = 1024 * 1024;
const MAX_WINDOWS_PATH = 259;
const FENCE = "`".repeat(3);

// ── Arguments ─────────────────────────────────────────────────────────────────

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`gen-synthetic-vault: ${message}`);
  process.exit(1);
}

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) fail(`unexpected argument "${argv[i]}"`);
  const eq = argv[i].indexOf("=");
  const key = argv[i].slice(2, eq < 0 ? undefined : eq);
  args[key] =
    eq >= 0 ? argv[i].slice(eq + 1) : key === "force" ? true : argv[++i];
}

const count = (key, fallback) => {
  const n = args[key] === undefined ? fallback : Number(args[key]);
  if (!Number.isInteger(n) || n < 0) fail(`--${key} must be a whole number`);
  return n;
};

if (!args.out) fail("--out <dir> is required");
if (args.preset && !PRESETS[args.preset])
  fail(`--preset must be one of ${Object.keys(PRESETS).join(", ")}`);
if (!args.preset && args.notes === undefined)
  fail("give --preset 1k|5k|20k|50k or --notes <n>");
const NOTES = args.notes === undefined ? PRESETS[args.preset] : count("notes");
const BIG = count("big", 3);
const TRASH = count("trash", 500);
const TASKS = count("tasks", 2000);
if (NOTES < 1) fail("--notes must be at least 1");
if (BIG > NOTES) fail("--big cannot be more than the notes in the tree");

const out = resolve(args.out);
const fromRepo = relative(repo, out);
const outside =
  isAbsolute(fromRepo) || fromRepo === ".." || fromRepo.startsWith(`..${sep}`);
// ponytail: a junction or symlink that leads into the repo is not detected
if (!outside)
  fail(`refusing to write inside the repo (${repo}); pick a folder outside it`);
// --force only replaces what this script made (its marker file is there); anything else is never deleted
let replace = false;
if (existsSync(out) && readdirSync(out).length > 0) {
  if (!existsSync(join(out, MARKER)))
    fail(
      `${out} is not empty and was not made by this script; empty it yourself`,
    );
  if (!args.force)
    fail(`${out} already holds a synthetic vault; pass --force to replace it`);
  replace = true;
}

// ── Random ────────────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const int = (n) => Math.floor(rand() * n);
const pick = (list) => list[int(list.length)];
const chance = (p) => rand() < p;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// nanoid's alphabet and length, so an id looks like the ones the app makes
const ALPHABET =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
const newId = () =>
  Array.from({ length: 21 }, () => ALPHABET[int(64)]).join("");

// ── Words ─────────────────────────────────────────────────────────────────────

const TOPICS =
  "atlas billing onboarding pipeline roadmap latency invoices migration kubernetes postgres retro hiring budget parser cache analytics mobile search release docs auth sync design backup vendor pricing support security metrics sprint".split(
    " ",
  );
const KINDS = [
  "Notes on",
  "Plan for",
  "Ideas for",
  "Checklist",
  "Summary of",
  "Questions about",
  "Draft",
  "Review of",
  "Log",
  "Meeting",
];
const VERBS =
  "review update write fix ship plan check draft call book send test merge clean move read".split(
    " ",
  );
const LEXICON =
  `the of and to a in is that for it with as on be at by this we from or an are will can not have more about when which one all
their there been if would who what out up so them some into time only new then other also our its should after before first because over
like see how each use two make well may way work need now these team plan ship note check review update decide owner risk scope budget
quarter customer feature release bug fix draft meeting follow agenda blocked waiting done later maybe urgent idea question answer
decision metric target launch backlog sprint demo design prototype feedback deadline vendor contract invoice report summary
café naïve über résumé`.split(/\s+/);
const RARE = "zebrafish quokka marzipan sextant tessellate obelisk".split(" "); // one in about 3% of the notes: a search with few hits
const FOLDER_ADJ =
  "Active Archive Client Draft Internal Personal Quarterly Research Shared Team".split(
    " ",
  );
const FOLDER_NOUN =
  "Projects Notes Meetings Ideas Reference Planning Reports Journal Snippets Guides".split(
    " ",
  );
const LANGS = ["ts", "js", "css", "sh", "sql", "html", ""];

// ── Notes ─────────────────────────────────────────────────────────────────────

const words = (n) => Array.from({ length: n }, () => pick(LEXICON)).join(" ");
const sentence = () => `${cap(words(6 + int(10)))}.`;
const paragraph = () => Array.from({ length: 2 + int(4) }, sentence).join(" ");
const bullets = () =>
  Array.from({ length: 2 + int(5) }, () => `- ${sentence()}`).join("\n");
const checkboxes = () =>
  Array.from(
    { length: 2 + int(5) },
    () => `- [${chance(0.4) ? "x" : " "}] ${cap(words(3 + int(6)))}`,
  ).join("\n");
const CODE_LINES = [
  (a, b) => `const ${a} = await load(${b});`,
  (a, b) => `if (!${a}) throw new Error("${b} is missing");`,
  (a, b) => `for (const ${a} of ${b}s) { run(${a}); }`,
  (a, b) => `export function ${a}(${b}: string): number {`,
  (_a, b) => `  return ${b}.length + ${int(100)};`,
  () => "}",
  (a, b) => `SELECT ${a}, ${b} FROM items WHERE id = ${int(1000)};`,
  (a, b) => `# ${a} ${b}`,
];
const code = () =>
  [
    `${FENCE}${pick(LANGS)}`,
    ...Array.from({ length: 3 + int(10) }, () =>
      pick(CODE_LINES)(pick(TOPICS), pick(VERBS)),
    ),
    FENCE,
  ].join("\n");
// [weight, make, what a note must have to get it]: only some notes have code or checkboxes
const BLOCKS = [
  [45, paragraph],
  [10, () => `## ${cap(words(2 + int(3)))}`],
  [15, bullets],
  [10, checkboxes, "checks"],
  [15, code, "code"],
  [5, () => `> ${sentence()}`],
];
function block(has) {
  const usable = BLOCKS.filter(([, , need]) => !need || has[need]);
  let left = int(usable.reduce((n, [weight]) => n + weight, 0));
  for (const [weight, make] of usable) {
    if (left < weight) return make();
    left -= weight;
  }
  return paragraph();
}

/** Markdown of about `size` characters, built from whole blocks, so no fence is cut open. */
function body(size, startsWithCode) {
  const huge = size > MAX_BODY; // a huge note has everything, to be heavy on the highlighter
  const has = {
    code: huge || startsWithCode || chance(0.35),
    checks: huge || chance(0.25),
  };
  const parts = startsWithCode ? [code()] : [];
  if (chance(0.03)) parts.push(`${sentence()} ${pick(RARE)}.`);
  let length = parts.reduce((n, p) => n + p.length + 2, 0);
  const limit = Math.max(size, MAX_BODY);
  while (length < size) {
    const next = block(has);
    if (length + next.length + 2 > limit) break;
    parts.push(next);
    length += next.length + 2;
  }
  return parts.join("\n\n");
}

function title() {
  if (chance(0.05)) return cap(words(8 + int(5))); // longer than the 50 characters a file name keeps
  const base = `${pick(KINDS)} ${pick(TOPICS)}`;
  return chance(0.4)
    ? `${base} ${chance(0.5) ? 2020 + int(7) : `v${1 + int(9)}`}`
    : base;
}

// Same as slugify in src/lib/itemPaths.ts
function slugify(text) {
  const slug = (text.trim() || "untitled")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return slug || "untitled";
}

// Same as serializeItem in src/lib/fileFormat.ts
const serialize = (n, text) =>
  [
    "---",
    `id: ${n.id}`,
    `title: ${n.title}`,
    `folderId: ${n.folder ?? "null"}`,
    `createdAt: ${n.createdAt}`,
    `updatedAt: ${n.updatedAt}`,
    ...(n.order === undefined ? [] : [`order: ${n.order}`]),
    "---",
    text,
  ].join("\n");

function makeNote(folder, extra = {}) {
  const created = NOW - (30 + int(700)) * DAY - int(DAY);
  const note = {
    id: newId(),
    title: title(),
    folder,
    createdAt: new Date(created).toISOString(),
    updatedAt: new Date(created + int(30 * DAY)).toISOString(),
    ...(chance(0.1) ? { order: 1024 * (1 + int(50)) } : {}),
    ...extra,
  };
  note.file = `${slugify(note.title)}-${note.id}.md`;
  return note;
}

// ── Plan: folders, then which note goes where ─────────────────────────────────

const folderCount = Math.ceil(NOTES / NOTES_PER_FOLDER);
const topCount = Math.max(1, Math.round(Math.sqrt(folderCount)));
const folders = []; // { path, depth }
const open = []; // folders that can still take a subfolder
const taken = new Set();
for (let i = 0; i < folderCount; i++) {
  const parent = i < topCount ? null : pick(open);
  const base = `${pick(FOLDER_ADJ)} ${pick(FOLDER_NOUN)}`;
  let name = base;
  for (let n = 2; taken.has(`${parent?.path ?? ""}/${name}`.toLowerCase()); n++)
    name = `${base} ${n}`;
  taken.add(`${parent?.path ?? ""}/${name}`.toLowerCase());
  const folder = {
    path: parent ? `${parent.path}/${name}` : name,
    depth: parent ? parent.depth + 1 : 1,
  };
  folders.push(folder);
  if (folder.depth < MAX_DEPTH) open.push(folder);
}

const regular = NOTES - BIG;
const places = [null, ...folders.map((f) => f.path)]; // the vault root takes its share too
const notes = Array.from({ length: regular }, (_, i) =>
  makeNote(places[i % places.length], { code: chance(0.1) }),
);
for (let i = 0; i < BIG; i++) {
  const mb = BIG === 1 ? 5 : 1 + (4 * i) / (BIG - 1); // 1, 3 and 5 MB for three
  notes.push(
    makeNote(pick(places), {
      title: `Huge note ${i + 1} (${+mb.toFixed(1)} MB)`,
      size: Math.round(mb * MB),
    }),
  );
}
const trash = Array.from({ length: TRASH }, () =>
  makeNote(chance(0.8) ? pick(places) : null),
);

// A file name too long for Windows would fail halfway through a long run
const longest = Math.max(
  ...notes.map(
    (n) =>
      out.length + 1 + (n.folder ? n.folder.length + 1 : 0) + n.file.length,
  ),
  ...trash.map((n) => out.length + "/.trash/".length + n.file.length),
);
if (process.platform === "win32" && longest > MAX_WINDOWS_PATH)
  fail(
    `the longest path would be ${longest} characters (Windows allows ${MAX_WINDOWS_PATH}); pick a shorter --out`,
  );

// ── Tasks, in the JSON of src/lib/taskStore.ts ────────────────────────────────

const local = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const today = Date.now();
const pretty = (value) =>
  `${JSON.stringify({ version: 1, ...value }, null, 2)}\n`;
const COLORS = ["red", "orange", "yellow", "green", "blue", "purple"];

const groups = ["Work", "Home"].map((name) => ({ id: newId(), name }));
const lists = [{ id: "tasks", name: "Tasks" }]; // the default list of src/lib/taskStore.ts
for (const name of [
  "Inbox",
  "Groceries",
  "Roadmap",
  "Bugs",
  "Reading",
  "Travel",
  "Chores",
]) {
  lists.push({
    id: newId(),
    name,
    ...(chance(0.7) ? { color: pick(COLORS) } : {}),
    ...(chance(0.6) ? { groupId: pick(groups).id } : {}),
  });
}
const tasksOf = Object.fromEntries(lists.map((l) => [l.id, []]));
for (let i = 0; i < TASKS; i++) {
  const list = chance(0.35) ? lists[0] : pick(lists);
  const created = NOW - int(365 * DAY);
  const done = chance(0.3);
  const task = {
    id: newId(),
    title: `${cap(pick(VERBS))} ${pick(TOPICS)} ${pick(LEXICON)}`,
    done,
    steps: Array.from({ length: chance(0.2) ? 1 + int(4) : 0 }, () => ({
      id: newId(),
      title: cap(words(2 + int(4))),
      done: chance(0.4),
    })),
    createdAt: new Date(created).toISOString(),
    updatedAt: new Date(created + int(20 * DAY)).toISOString(),
  };
  if (done) task.doneAt = task.updatedAt;
  if (chance(0.15)) task.important = true;
  if (chance(0.4)) task.due = local(today + (int(60) - 15) * DAY);
  if (!done && chance(0.03)) task.myDay = local(today);
  if (chance(0.15)) task.note = paragraph();
  tasksOf[list.id].push(task);
}
for (const [at, list] of lists.entries())
  tasksOf[list.id]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((t, k) => {
      if (at % 3 === 1) t.order = 1024 * (k + 1); // a few lists have a chosen order
    });

// ── Write ─────────────────────────────────────────────────────────────────────

const started = Date.now();
let bytes = 0;
const BATCH = 128;

async function writeNotes(list, dir, flat = false) {
  for (let from = 0; from < list.length; from += BATCH) {
    // The text is made in this order, so the same seed gives the same files; only the writes overlap
    const jobs = list.slice(from, from + BATCH).map((n) => {
      const text = serialize(
        n,
        body(n.size ?? MIN_BODY + int(MAX_BODY - MIN_BODY), n.code),
      );
      bytes += Buffer.byteLength(text);
      return writeFile(join(dir, flat ? "" : (n.folder ?? ""), n.file), text);
    });
    await Promise.all(jobs);
  }
}

if (replace) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of folders) mkdirSync(join(out, f.path), { recursive: true });
mkdirSync(join(out, ".trash"));
mkdirSync(join(out, ".tasks"));

await writeNotes(notes, out);
await writeNotes(trash, join(out, ".trash"), true); // the trash is flat; a note's old folder is in its frontmatter

const ranks = {};
for (const f of folders) if (chance(0.1)) ranks[f.path] = 1024 * (1 + int(20));
if (Object.keys(ranks).length)
  writeFileSync(
    join(out, ".folder-order.json"),
    JSON.stringify(ranks, null, 2),
  );
writeFileSync(join(out, ".tasks", "index.json"), pretty({ groups, lists }));
for (const list of lists)
  writeFileSync(
    join(out, ".tasks", `${list.id}.json`),
    pretty({ tasks: tasksOf[list.id] }),
  );

const summary = {
  generator: "scripts/gen-synthetic-vault.mjs",
  seed: SEED,
  notes: notes.length,
  huge: BIG,
  folders: folders.length,
  trash: trash.length,
  tasks: TASKS,
  lists: lists.length,
  groups: groups.length,
  megabytesOfNotes: Math.round(bytes / MB), // the tree and the trash together
};
writeFileSync(join(out, MARKER), `${JSON.stringify(summary, null, 2)}\n`);
console.log(
  `Wrote ${out}\n${JSON.stringify(summary)}\nin ${((Date.now() - started) / 1000).toFixed(1)} s. Add it in Settings > Vaults.`,
);
