// src/components/VaultImage.tsx
import { readFile } from "@tauri-apps/plugin-fs";
import { type ComponentProps, useContext, useEffect, useState } from "react";
import type { ExtraProps } from "react-markdown";
import { VaultPathContext } from "../lib/attachmentStore";
import { mimeOf, resolveAttachment } from "../lib/attachments";

/**
 * An image in a note. A link through attachments/ is read from the vault and shown from a blob URL
 * (no asset-protocol setup, and it works for a vault anywhere); anything else, such as a web
 * address, is a plain <img>.
 */
function VaultImage({
  node: _node,
  src,
  alt,
  ...rest
}: ComponentProps<"img"> & ExtraProps) {
  const vault = useContext(VaultPathContext);
  const path =
    vault && typeof src === "string" ? resolveAttachment(vault, src) : null;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let blobUrl: string | null = null;
    let stale = false;
    setUrl(null);
    readFile(path)
      .then((bytes) => {
        if (stale) return;
        blobUrl = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: mimeOf(path) }),
        );
        setUrl(blobUrl);
      })
      .catch((err) => console.warn("[VaultImage] cannot read", path, err));
    return () => {
      stale = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [path]);

  if (!path) return <img src={src} alt={alt} {...rest} />;
  if (!url) return <span className="note-image-missing">{alt || "image"}</span>;
  return <img src={url} alt={alt} {...rest} />;
}

export default VaultImage;
