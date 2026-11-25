// src/lib/imageCache.ts
// An LRU cache of the pictures shown in notes: a blob URL per key, capped by count and by the total
// bytes of the files. A picture an <img> still shows is held (`acquire` and `put` take a hold,
// `release` gives it back) and is never evicted, so a URL is revoked only when nothing shows it.
// The key is opaque; VaultImage uses the file's path. ponytail: a file replaced on disk under the
// same name shows its old picture until it is evicted or the app restarts: the fs plugin's `stat`
// is not in the capability, so there is no mtime or size to put in the key; add `fs:allow-stat` and
// make the key `${path}|${mtime}|${size}` to fix it.

/** The most pictures the cache keeps. */
export const IMAGE_CACHE_MAX_ENTRIES = 64;
/** The most bytes (of the picture files) the cache keeps. */
export const IMAGE_CACHE_MAX_BYTES = 64 * 1024 * 1024;

interface Entry {
  url: string;
  bytes: number;
  holds: number;
}

export function createImageCache(
  dispose: (url: string) => void,
  maxEntries = IMAGE_CACHE_MAX_ENTRIES,
  maxBytes = IMAGE_CACHE_MAX_BYTES,
) {
  // Insertion order is recency: the first key is the least recently used
  const entries = new Map<string, Entry>();
  let total = 0;

  const touch = (key: string, entry: Entry) => {
    entries.delete(key);
    entries.set(key, entry);
  };

  // Drops the least recently used pictures nobody holds until the cache is within both caps. If
  // everything is held it stays over them until a release.
  const evict = () => {
    for (const [key, entry] of entries) {
      if (entries.size <= maxEntries && total <= maxBytes) return;
      if (entry.holds > 0) continue;
      entries.delete(key);
      total -= entry.bytes;
      dispose(entry.url);
    }
  };

  return {
    /** Whether `key` is cached (no hold is taken). */
    has(key: string): boolean {
      return entries.has(key);
    },

    /** The cached URL, now held until `release`, or undefined when `key` is not cached. */
    acquire(key: string): string | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entry.holds++;
      touch(key, entry);
      return entry.url;
    },

    /**
     * Caches `url` (a picture of `bytes` bytes) under `key`, held until `release`, and returns the URL
     * to show. When `key` is already cached, that URL is returned (and held) and the new one disposed.
     */
    put(key: string, url: string, bytes: number): string {
      const entry = entries.get(key);
      if (entry) {
        if (entry.url !== url) dispose(url);
        entry.holds++;
        touch(key, entry);
        return entry.url;
      }
      entries.set(key, { url, bytes, holds: 1 });
      total += bytes;
      evict();
      return url;
    },

    /** Gives back one hold; a picture over the caps goes once nothing holds it. */
    release(key: string) {
      const entry = entries.get(key);
      if (!entry || entry.holds === 0) return;
      entry.holds--;
      evict();
    },

    get size() {
      return entries.size;
    },
    get bytes() {
      return total;
    },
  };
}
