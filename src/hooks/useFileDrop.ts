// src/hooks/useFileDrop.ts
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";
import { CODE_EXTS, fence, parseNoteFile } from "../lib/fileFormat";
import type { AddItemFields } from "./useItems";

export function useFileDrop(
  addItem: (fields: AddItemFields) => string,
  // Folder the files are imported into (null = vault root)
  getFolderId: () => string | null,
  // Called with the id of an imported item so the app can open it
  onImported: (id: string) => void,
): { isDraggingOver: boolean } {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Latest callbacks without re-subscribing the native drop listener on every render
  const latest = useRef({ getFolderId, onImported });
  useEffect(() => {
    latest.current = { getFolderId, onImported };
  });

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
          const folderId = latest.current.getFolderId();
          const importedIds: string[] = [];
          await Promise.allSettled(
            payload.paths.map(async (rawPath) => {
              const filePath = rawPath.replace(/\\/g, "/");
              const fileName = filePath.split("/").pop() ?? "";
              const dotIdx = fileName.lastIndexOf(".");
              const ext =
                dotIdx >= 0 ? fileName.slice(dotIdx).toLowerCase() : "";
              const fileBaseName =
                dotIdx >= 0 ? fileName.slice(0, dotIdx) : fileName;

              if (ext !== ".md" && !CODE_EXTS.has(ext)) return;

              try {
                const content = await readTextFile(filePath);
                if (aborted) return;
                if (ext === ".md") {
                  const parsed = parseNoteFile(content);
                  const title = parsed.id
                    ? parsed.title || fileBaseName
                    : fileBaseName;
                  const body = parsed.id ? parsed.body : content;
                  importedIds.push(addItem({ title, body, folderId }));
                } else {
                  // Code files become a note holding one fenced block (js, ts, css, scss, html, sh)
                  importedIds.push(
                    addItem({
                      title: fileBaseName,
                      body: fence(content, ext.slice(1)),
                      folderId,
                    }),
                  );
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
          const lastId = importedIds[importedIds.length - 1];
          if (lastId && !aborted) latest.current.onImported(lastId);
        }
      },
    );

    return () => {
      aborted = true;
      unlistenPromise.then((unlisten) => unlisten()).catch(console.error);
    };
  }, [addItem]);

  return { isDraggingOver };
}
