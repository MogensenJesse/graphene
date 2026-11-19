// src/lib/mcpClients.test.ts
import { expect, test } from "vitest";
import { CLIENTS, connectSnippet } from "./mcpClients";

const path = "C:\\Program Files\\Graphene\\mcp\\graphene-mcp.mjs";

test("terminal clients get the path quoted", () => {
  for (const [id, start] of [
    ["claude-code", "claude mcp add --scope user graphene -- "],
    ["codex", "codex mcp add graphene -- "],
    ["gemini", "gemini mcp add --scope user graphene -- "],
  ] as const) {
    expect(connectSnippet(id, path)).toEqual({
      text: `${start}node "${path}"`,
    });
  }
});

test("JSON clients get the escaped path as an argument, and the file their client reads", () => {
  for (const [id, file] of [
    ["cursor", "~/.cursor/mcp.json"],
    ["vscode", "~/.copilot/mcp-config.json"],
    ["other", undefined],
  ] as const) {
    const snippet = connectSnippet(id, path);
    expect(snippet.file).toBe(file);
    expect(JSON.parse(snippet.text)).toEqual({
      mcpServers: { graphene: { command: "node", args: [path] } },
    });
  }
});

test("every client in the picker has a snippet", () => {
  for (const { id, label, hint } of CLIENTS) {
    expect(label && hint).toBeTruthy();
    expect(connectSnippet(id, path).text).toContain("graphene-mcp.mjs");
  }
});
