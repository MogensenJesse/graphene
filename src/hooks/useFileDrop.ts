// src/hooks/useFileDrop.ts
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useEffect, useState } from "react";
import { langFromExt, parseNoteFile } from "../lib/fileFormat";
import type { SnippetItem } from "../types";
import type { AddNoteFields, AddSnippetFields } from "./useItems";

const SUPPORTED_EXTS = new Set([
  ".md",
  ".js",
  ".ts",
  ".css",
  ".scss",
  ".html",
  ".sh",
]);

export function useFileDrop(
  addNote: (fields: AddNoteFields) => string,
  addSnippet: (fields: AddSnippetFields) => string,
): { isDraggingOver: boolean } {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    let aborted = false;
    const unlistenPromise = getCurrentWebview().onDragDropEvent(
      async (event) => {
        const { payload } = event;
        if (payload.type === "over") {
          setIsDraggingOver(true);
        } else if (payload.type === "leave") {
          setIsDraggingOver(false);
        } else if (payload.type === "drop") {
          setIsDraggingOver(false);
          await Promise.allSettled(
            payload.paths.map(async (rawPath) => {
              const filePath = rawPath.replace(/\\/g, "/");
              const fileName = filePath.split("/").pop() ?? "";
              const dotIdx = fileName.lastIndexOf(".");
              const ext =
                dotIdx >= 0 ? fileName.slice(dotIdx).toLowerCase() : "";
              const fileBaseName =
                dotIdx >= 0 ? fileName.slice(0, dotIdx) : fileName;

              if (!SUPPORTED_EXTS.has(ext)) return;

              try {
                const content = await readTextFile(filePath);
                if (aborted) return;
                if (ext === ".md") {
                  const parsed = parseNoteFile(content);
                  const title = parsed.id
                    ? parsed.title || fileBaseName
                    : fileBaseName;
                  const body = parsed.id ? parsed.body : content;
                  addNote({ title, body, folderId: null });
                } else {
                  const lang = langFromExt(ext) as SnippetItem["lang"];
                  addSnippet({
                    title: fileBaseName,
                    code: content,
                    lang,
                    note: "",
                    folderId: null,
                  });
                }
              } catch (err) {
                console.error(
                  "[useFileDrop] Failed to read file:",
                  filePath,
                  err,
                );
              }
            }),
          );
        }
      },
    );

    return () => {
      aborted = true;
      unlistenPromise.then((unlisten) => unlisten()).catch(console.error);
    };
  }, [addNote, addSnippet]);

  return { isDraggingOver };
}
