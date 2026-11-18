// src/hooks/useImageInsert.ts
import { type RefObject, useCallback, useContext, useEffect } from "react";
import { saveImage, VaultPathContext } from "../lib/attachmentStore";
import { attachmentLink, extForMime } from "../lib/attachments";
import { replaceText } from "./useMarkdownFormat";

/**
 * Pictures in the editor's text. Dropped files arrive through `insertImagesRef` (the app saves them);
 * a pasted picture is saved here. Each is linked on a line of its own at the cursor, relative to
 * `linkFolder`, the folder the note is saved in. Returns the textarea's paste handler.
 */
export function useImageInsert(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  linkFolder: string | null,
  insertImagesRef: RefObject<((files: string[]) => void) | null>,
): (e: React.ClipboardEvent<HTMLTextAreaElement>) => void {
  const vaultPath = useContext(VaultPathContext);

  const insertImages = useCallback(
    (files: string[]) => {
      const el = textareaRef.current;
      if (!el) return;
      const text = files
        .map((file) => `![](${attachmentLink(linkFolder, file)})`)
        .join("\n");
      const { value, selectionStart: ss, selectionEnd: se } = el;
      const before = ss > 0 && value[ss - 1] !== "\n" ? "\n" : "";
      const after = se < value.length && value[se] !== "\n" ? "\n" : "";
      const insert = before + text + after;
      const caret = ss + insert.length;
      replaceText(el, {
        value: value.slice(0, ss) + insert + value.slice(se),
        ss: caret,
        se: caret,
      });
    },
    [textareaRef, linkFolder],
  );

  useEffect(() => {
    insertImagesRef.current = insertImages;
    return () => {
      insertImagesRef.current = null;
    };
  }, [insertImagesRef, insertImages]);

  // A pasted picture (a screenshot, an image copied from a page) is saved in attachments/ and linked.
  // Text on the clipboard wins: a spreadsheet copy carries a picture of its cells too.
  return (e) => {
    if (!vaultPath || e.clipboardData.getData("text/plain")) return;
    const pics = Array.from(e.clipboardData.files).flatMap((file) => {
      const ext = extForMime(file.type);
      return ext ? [{ file, ext }] : [];
    });
    if (pics.length === 0) return;
    e.preventDefault();
    Promise.all(
      pics.map(async ({ file, ext }) =>
        saveImage(vaultPath, new Uint8Array(await file.arrayBuffer()), ext),
      ),
    )
      .then(insertImages)
      .catch(console.error);
  };
}
