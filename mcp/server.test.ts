// mcp/server.test.ts
// The server with several vaults, spoken to through the protocol like an assistant would.
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { test } from "vitest";
import { serializeItem } from "../src/lib/fileFormat";
import { itemFilePath } from "../src/lib/itemPaths";
import { joinPath } from "../src/lib/paths";
import type { Item } from "../src/types";
import { createServer } from "./server";
import { configVaults } from "./vault";

const note = (id: string, title: string, body: string): Item => ({
  id,
  title,
  folderId: null,
  body,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
});

interface Setup {
  /** Paths of the vaults "Home" and "Work", and a third, not shared, "Diary" */
  home: string;
  work: string;
  diary: string;
  /** Rewrites Graphene's config, as the app does when something changes */
  writeConfig: (config: unknown) => void;
  client: Client;
}

/** Three vaults on disk with a note each, a config listing them, and a server reading that config. */
async function withServer(
  run: (setup: Setup) => Promise<void>,
  config?: (paths: Record<"home" | "work" | "diary", string>) => unknown,
) {
  const root = joinPath(mkdtempSync(joinPath(tmpdir(), "graphene-multi-")));
  const make = (folder: string, item: Item) => {
    const vault = joinPath(root, folder);
    mkdirSync(vault, { recursive: true });
    writeFileSync(itemFilePath(vault, item), serializeItem(item));
    return vault;
  };
  const home = make("home-folder", note("h1", "Groceries", "- [ ] milk\n"));
  const work = make("work-folder", note("w1", "Standup", "Notes of today\n"));
  const diary = make("diary-folder", note("d1", "Secret", "Dear diary\n"));
  const dir = joinPath(root, "com.graphene.app", "graphene");
  mkdirSync(dir, { recursive: true });
  const configFile = joinPath(dir, "config.json");
  const writeConfig = (value: unknown) =>
    writeFileSync(configFile, JSON.stringify(value));
  writeConfig(
    config?.({ home, work, diary }) ?? {
      active: work,
      vaults: [
        { path: home, name: "Home", shared: true },
        { path: work, name: "Work", shared: true },
        { path: diary, name: "Diary", shared: false },
      ],
    },
  );

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(configVaults({ APPDATA: root })).connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  try {
    await run({ home, work, diary, writeConfig, client });
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
}

/** The answer of a tool call: parsed JSON, or the error text when the call failed. */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const result = await client.callTool({ name, arguments: args });
  const [first] = result.content as { text: string }[];
  return result.isError
    ? { error: first.text }
    : { ok: JSON.parse(first.text) as Record<string, unknown> };
}

const titles = (answer: { ok?: Record<string, unknown> }) =>
  ((answer.ok?.notes ?? []) as { title: string }[]).map((n) => n.title);

test("list_vaults names the shared vaults and marks the one open in Graphene", () =>
  withServer(async ({ client }) => {
    const answer = await call(client, "list_vaults");
    assert.deepEqual(answer.ok, {
      vaults: [
        { name: "Home", active: false },
        { name: "Work", active: true },
      ],
    });
    assert.ok(!JSON.stringify(answer).includes("-folder")); // no paths
  }));

test("reads go to the vault open in Graphene unless one is named, and say which they used", () =>
  withServer(async ({ client }) => {
    const open = await call(client, "search_notes");
    assert.equal(open.ok?.vault, "Work");
    assert.deepEqual(titles(open), ["Standup"]);

    const named = await call(client, "search_notes", { vault: "home" }); // case does not matter
    assert.equal(named.ok?.vault, "Home");
    assert.deepEqual(titles(named), ["Groceries"]);

    const folders = await call(client, "list_folders", { vault: "Home" });
    assert.equal(folders.ok?.vault, "Home");
    assert.equal(folders.ok?.notesWithoutFolder, 1);
  }));

test("a vault that is not shared cannot be read or named", () =>
  withServer(async ({ client, diary }) => {
    for (const vault of ["Diary", diary, "../diary-folder"]) {
      const answer = await call(client, "search_notes", { vault });
      assert.match(answer.error ?? "", /no shared vault called/);
      assert.match(answer.error ?? "", /Home, Work/); // says what can be named
    }
    // and its notes never turn up in the others
    assert.deepEqual(
      titles(await call(client, "search_notes", { query: "diary" })),
      [],
    );
  }));

test("a path is not a vault name", () =>
  withServer(async ({ client, home }) => {
    const answer = await call(client, "read_note", { id: "h1", vault: home });
    assert.match(answer.error ?? "", /no shared vault called/);
  }));

test("with several vaults shared, a write has to name one", () =>
  withServer(async ({ client, home, work }) => {
    for (const [name, args] of [
      ["create_note", { title: "X" }],
      ["append_to_note", { id: "h1", text: "more" }],
      ["edit_note", { id: "h1", old_text: "milk", new_text: "oat milk" }],
      ["add_task", { title: "X" }],
      ["update_task", { id: "x", title: "Y" }],
      ["complete_task", { id: "x" }],
      ["create_task_list", { name: "X" }],
    ] as const) {
      const answer = await call(client, name, args);
      assert.match(answer.error ?? "", /Several vaults are shared/, name);
    }
    assert.equal(readdirSync(home).length, 1); // nothing was written anywhere
    assert.equal(readdirSync(work).length, 1);
  }));

test("a write goes to the vault it names and to no other", () =>
  withServer(async ({ client, home, work }) => {
    const created = await call(client, "create_note", {
      title: "Plan",
      vault: "Home",
    });
    assert.equal(created.ok?.vault, "Home");
    assert.equal(readdirSync(home).length, 2);
    assert.equal(readdirSync(work).length, 1);

    // the same id means nothing in the other vault
    const missing = await call(client, "append_to_note", {
      id: "h1",
      text: "x",
      vault: "Work",
    });
    assert.ok(missing.error);
  }));

test("with one vault shared, a write needs no name", () =>
  withServer(
    async ({ client, home }) => {
      const created = await call(client, "create_note", { title: "Plan" });
      assert.equal(created.ok?.vault, "Home");
      assert.equal(readdirSync(home).length, 2);
    },
    ({ home, work }) => ({
      active: work,
      vaults: [
        { path: home, name: "Home" },
        { path: work, name: "Work", shared: false },
      ],
    }),
  ));

test("changes made in the app apply to the next call", () =>
  withServer(async ({ client, home, work, writeConfig }) => {
    // Work is no longer shared, and Home is renamed
    writeConfig({
      active: home,
      vaults: [
        { path: home, name: "Personal" },
        { path: work, name: "Work", shared: false },
      ],
    });
    assert.deepEqual((await call(client, "list_vaults")).ok, {
      vaults: [{ name: "Personal", active: true }],
    });
    assert.match(
      (await call(client, "search_notes", { vault: "Work" })).error ?? "",
      /no shared vault called/,
    );
    assert.deepEqual(titles(await call(client, "search_notes")), ["Groceries"]);
  }));

test("with nothing shared the tools say how to share a vault", () =>
  withServer(
    async ({ client }) => {
      assert.deepEqual((await call(client, "list_vaults")).ok, { vaults: [] });
      assert.match(
        (await call(client, "search_notes")).error ?? "",
        /Share with AI assistants/,
      );
    },
    ({ home }) => ({ vaults: [{ path: home, shared: false }] }),
  ));
