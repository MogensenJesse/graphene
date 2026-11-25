// src/components/note/VaultImage.tsx
import { readFile } from "@tauri-apps/plugin-fs";
import {
  type ComponentProps,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ExtraProps } from "react-markdown";
import { VaultPathContext } from "../../lib/attachmentStore";
import { mimeOf, resolveAttachment } from "../../lib/attachments";
import { createImageCache } from "../../lib/imageCache";

// A picture is read once its place is within this far of the scroll pane's edge, so a long note does
// not read every picture on opening
const READ_AHEAD = "600px 0px";

// The blob URLs of the pictures read so far, shared by every note: switching back to a note shows its
// pictures at once. See imageCache.ts for the caps and for when a URL is revoked.
const images = createImageCache((url) => URL.revokeObjectURL(url));

// The nearest ancestor that scrolls: the observer measures against it, because it clips what lies
// beyond its edge, so the margin of the page itself would not reach a picture inside the pane
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

/** A picture from the vault: not read until it is near the view, then shown from the cache or a new blob URL. */
function CachedImage({
  path,
  alt,
  ...rest
}: { path: string } & ComponentProps<"img">) {
  const [url, setUrl] = useState<string | null>(null);
  // a picture already in the cache needs no waiting for the observer
  const [near, setNear] = useState(() => images.has(path));
  const placeholder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = placeholder.current;
    if (near || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: scrollParent(el), rootMargin: READ_AHEAD },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let stale = false;
    let held = false; // this <img> holds the cache entry, so it is not evicted while shown
    const hit = images.acquire(path);
    if (hit) {
      held = true;
      setUrl(hit);
    } else {
      readFile(path)
        .then((bytes) => {
          const made = URL.createObjectURL(
            new Blob([bytes], { type: mimeOf(path) }),
          );
          const shown = images.put(path, made, bytes.length);
          if (stale) images.release(path);
          else {
            held = true;
            setUrl(shown);
          }
        })
        .catch((err) => console.warn("[VaultImage] cannot read", path, err));
    }
    return () => {
      stale = true;
      if (held) images.release(path);
    };
  }, [near, path]);

  // Until it is read, and when the file cannot be: the alt text
  if (!url)
    return (
      <span ref={placeholder} className="note-image-missing">
        {alt || "image"}
      </span>
    );
  return <img src={url} alt={alt} {...rest} />;
}

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
  if (!path) return <img src={src} alt={alt} {...rest} />;
  // keyed by the file, so a link that changes to another picture starts over
  return <CachedImage key={path} path={path} alt={alt} {...rest} />;
}

export default VaultImage;
