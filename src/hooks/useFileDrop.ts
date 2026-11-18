// src/hooks/useFileDrop.ts
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useEffect, useState } from "react";
import { isImagePath } from "../lib/attachments";
import { CODE_EXTS, fence, parseNoteFile } from "../lib/fileFormat";
import { extOf, fileName, joinPath } from "../lib/paths";
import type { AddItemFields } from "./useItems";
import { useLatest } from "./useLatest";

interface FileDropOptions {
  addItem: (fields: AddItemFields) => string;
  /** Folder the files are imported into (null = vault root). */
  getFolderId: () => string | null;
  /** Called with the id of an imported item so the app can open it. */
  onImported: (id: string) => void;
  /** Called with the image files of a drop; returns false when nothing can take them (no editor open). */
  onImages: (paths: string[]) => Promise<boolean>;
}

export function useFileDrop(options: FileDropOptions): {
  isDraggingOver: boolean;
} {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Latest callbacks without re-subscribing the native drop listener on every render
  const latest = useLatest(options);

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
          const { addItem, getFolderId, onImported, onImages } = latest.current;
          const folderId = getFolderId();
          const importedIds: string[] = [];
          // Pictures go into the note being edited; with no editor open they are ignored, as other files are
          const images = payload.paths.filter(isImagePath);
          if (images.length > 0) {
            await onImages(images).catch(console.error);
          }
          await Promise.allSettled(
            payload.paths.map(async (rawPath) => {
              const filePath = joinPath(rawPath);
              const name = fileName(filePath);
              const ext = extOf(name);
              if (ext !== "md" && !CODE_EXTS.has(ext)) return;
              const baseName = ext ? name.slice(0, -(ext.length + 1)) : name;

              try {
                const content = await readTextFile(filePath);
                if (aborted) return;
                if (ext === "md") {
                  const parsed = parseNoteFile(content);
                  const title = parsed.id ? parsed.title || baseName : baseName;
                  const body = parsed.id ? parsed.body : content;
                  importedIds.push(addItem({ title, body, folderId }));
                } else {
                  // Code files become a note holding one fenced block (js, ts, css, scss, html, sh)
                  importedIds.push(
                    addItem({
                      title: baseName,
                      body: fence(content, ext),
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
          if (lastId && !aborted) onImported(lastId);
        }
      },
    );

    return () => {
      aborted = true;
      unlistenPromise.then((unlisten) => unlisten()).catch(console.error);
    };
  }, [latest]);

  return { isDraggingOver };
}
