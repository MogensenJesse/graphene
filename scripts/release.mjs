// scripts/release.mjs
// Behind `npm version <patch|minor|major|x.y.z>` (see "preversion" and "version" in package.json):
//   check  before the bump: CHANGELOG.md needs release notes under "## Unreleased", in the house format
//   apply  after the bump:  "## Unreleased" becomes "## v<version>", src-tauri follows, files get staged
// npm then commits ("Release v<version>", see .npmrc) and tags v<version>. Pushing stays a manual step.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const CHANGELOG = "CHANGELOG.md";
const CARGO_TOML = "src-tauri/Cargo.toml";
const CARGO_LOCK = "src-tauri/Cargo.lock";
const SECTIONS = ["New", "Changed", "Fixes", "Other"];

const fail = (message) => {
  console.error(`\nrelease: ${message}\n`);
  process.exit(1);
};

/** The text under "## Unreleased", up to the next "## " heading; null when there is no such heading. */
function unreleasedNotes(changelog) {
  const match = /^## Unreleased[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(
    changelog,
  );
  return match ? match[1].trim() : null;
}

function check() {
  const notes = unreleasedNotes(readFileSync(CHANGELOG, "utf8"));
  if (notes === null)
    fail(
      `${CHANGELOG} has no "## Unreleased" section. Add the changes there first.`,
    );
  if (!/^- /m.test(notes))
    fail(`"## Unreleased" in ${CHANGELOG} has no bullet points yet.`);

  const unknown = [...notes.matchAll(/^### (.+?)\s*$/gm)]
    .map((m) => m[1])
    .filter((heading) => !SECTIONS.includes(heading));
  if (unknown.length > 0)
    fail(
      `Unknown section "${unknown.join('", "')}" in "## Unreleased". Use: ${SECTIONS.join(", ")}.`,
    );
}

function apply() {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));

  // Keep each file's own line endings (the working tree is CRLF)
  const edit = (path, change) => {
    const before = readFileSync(path, "utf8");
    const after = change(before, before.includes("\r\n") ? "\r\n" : "\n");
    if (after === before) fail(`Could not update the version in ${path}.`);
    writeFileSync(path, after);
  };

  // A fresh, empty "Unreleased" stays on top for the next release's notes
  edit(CHANGELOG, (text, eol) =>
    text.replace(
      /^## Unreleased[ \t]*$/m,
      `## Unreleased${eol}${eol}## v${version}`,
    ),
  );
  edit(CARGO_TOML, (text) =>
    text.replace(/^version = ".*"$/m, `version = "${version}"`),
  );
  edit(CARGO_LOCK, (text) =>
    text.replace(/(name = "graphene"\r?\nversion = )"[^"]*"/, `$1"${version}"`),
  );

  // tauri.conf.json reads package.json, so nothing to do there
  execFileSync("git", ["add", CHANGELOG, CARGO_TOML, CARGO_LOCK], {
    stdio: "inherit",
  });
}

const modes = { check, apply };
const mode = modes[process.argv[2]];
if (!mode) fail("usage: node scripts/release.mjs <check|apply>");
mode();
