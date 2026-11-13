// src/hooks/useUpdater.ts
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReleaseNotes, type ReleaseNote } from "../lib/releaseNotes";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date" // flashes for a moment after a manual check, then back to idle
  | "error" // a manual check failed; flashes, the message stays in `error`
  | "installing";

const AUTO_CHECK_DELAY_MS = 5000; // let the vault load before touching the network
const FLASH_MS = 2500;

const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/**
 * Looks for a newer release once after launch and on demand. The install is the user's call:
 * `update` is set when one exists, and `install` downloads it and hands over to the installer
 * (on Windows the app quits and the installer reopens it).
 */
export function useUpdater(flushPendingSave: () => Promise<void>) {
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<Update | null>(null);
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [progress, setProgress] = useState(0); // 0..1 while installing
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const flash = useCallback((next: UpdateStatus) => {
    setStatus(next);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setStatus("idle"), FLASH_MS);
  }, []);

  // quiet = the launch check: a failure (offline) is not worth telling anyone about
  const run = useCallback(
    async (quiet: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setStatus("checking");
      setError(null);
      try {
        const found = await check();
        if (found) {
          setUpdate(found);
          setNotes(await fetchReleaseNotes(await getVersion(), found.version));
          setStatus("idle");
        } else {
          flash("up-to-date");
        }
      } catch (err) {
        console.warn("[updater] check failed:", err);
        if (quiet) {
          setStatus("idle");
        } else {
          setError(messageOf(err));
          flash("error");
        }
      } finally {
        busy.current = false;
      }
    },
    [flash],
  );

  useEffect(() => {
    if (import.meta.env.DEV) return; // a dev build must never replace itself with a release
    const timer = setTimeout(() => void run(true), AUTO_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [run]);

  const install = useCallback(async () => {
    if (!update || busy.current) return;
    busy.current = true;
    setStatus("installing");
    setProgress(0);
    setError(null);
    try {
      await flushPendingSave(); // the installer closes the window; do not lose an edit
      let total = 0;
      let done = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        else if (event.event === "Progress") {
          done += event.data.chunkLength;
          if (total > 0) setProgress(Math.min(1, done / total));
        } else setProgress(1);
      });
      // Past this point Windows is quitting the app for the installer
    } catch (err) {
      console.error("[updater] install failed:", err);
      setError(messageOf(err));
      setStatus("idle");
      busy.current = false;
    }
  }, [update, flushPendingSave]);

  return {
    version,
    update,
    notes,
    status,
    progress,
    error,
    canInstall: !import.meta.env.DEV,
    checkNow: useCallback(() => run(false), [run]),
    install,
  };
}
