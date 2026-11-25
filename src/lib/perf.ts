// src/lib/perf.ts
// Startup and frame timing, so performance work is decided by numbers (docs/plans/01-audit-fixes.md, WP0).
// Off unless localStorage["graphene.perf"] is "1", in a release build too; off, every call is a no-op. Nothing here
// throws, whatever the webview lacks. Read the result with perfReport() in the inspector (a debug build has one).
//
// The startup marks, in the order they come since the Rust scan (WP5; docs/plans/00-baseline.md has the numbers from before it,
// where `bodies-read` came BEFORE `items-set`):
//   main, config-ready   the script ran; the vault config is known
//   scan-done            scan_vault returned (loadVault): the list of notes, no text
//   items-set            the list was committed to state (App, right after the scan)
//   first-populated-paint  the first frame with notes in it was painted: the time to first paint of the sidebar
//   bodies-read          the LAST note text has landed (useBodies, after the paint): from here Ctrl+K searches text everywhere
// The baseline's "bodies step" is now the span from first-populated-paint to bodies-read, and no longer holds up the paint.
import { readPref } from "./prefs";

const on = () => readPref("graphene.perf") === "1";
const ms = (n: number) => Math.round(n * 10) / 10;

/** Marks `name` on the timeline. The first mark of a name wins, so a later rescan cannot move a startup mark. */
export function perfMark(name: string): void {
  try {
    if (on() && performance.getEntriesByName(name, "mark").length === 0)
      performance.mark(name);
  } catch {
    // Timing is optional
  }
}

/** Marks `name` once the frame after this call has been painted (the timeout runs after the paint the frame callback precedes). */
export function perfMarkAfterPaint(name: string): void {
  try {
    if (on()) requestAnimationFrame(() => setTimeout(() => perfMark(name)));
  } catch {
    // Timing is optional
  }
}

interface MarkRow {
  mark: string;
  at_ms: number;
  step_ms: number;
  since_load_ms: number;
}

/** The marks as table rows: when each came after the first one, after the one before it, and after the page began to load. */
export function markRows(
  marks: { name: string; startTime: number }[],
): MarkRow[] {
  const sorted = [...marks].sort((a, b) => a.startTime - b.startTime);
  return sorted.map((m, i) => ({
    mark: m.name,
    at_ms: ms(m.startTime - sorted[0].startTime),
    step_ms: i === 0 ? 0 : ms(m.startTime - sorted[i - 1].startTime),
    since_load_ms: ms(m.startTime),
  }));
}

const longFrames: {
  at_ms: number;
  duration_ms: number;
  blocking_ms: number;
}[] = [];

/** Records every frame that took over 50 ms (the long-animation-frame entry type, where the webview has it). */
export function observeLongFrames(): void {
  try {
    if (
      !on() ||
      !PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")
    )
      return;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        longFrames.push({
          at_ms: ms(e.startTime),
          duration_ms: ms(e.duration),
          blocking_ms: ms(
            (e as PerformanceEntry & { blockingDuration?: number })
              .blockingDuration ?? 0,
          ),
        });
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {
    // Timing is optional
  }
}

// IPC calls, counted from the requests the webview makes for them. Tauri defines `invoke` and `ipc` as read-only, so
// they cannot be wrapped; its IPC is a fetch to http://ipc.localhost/<command> (ipc://localhost/ off Windows), which
// the resource timeline lists. checked in a WebView2 release build (docs/plans/00-baseline.md): the observer
// sees every call, though the resource buffer itself keeps only 250 entries.
const ipcCalls = new Map<string, number>();

/** The command a Tauri IPC request URL asks for ("plugin:fs|read_text_file"), or null for any other URL. */
export function ipcCommand(url: string): string | null {
  const m = /^(?:https?:\/\/ipc\.localhost|ipc:\/\/localhost)\/([^?#]+)/.exec(
    url,
  );
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Counts the IPC calls by command, to be read in perfReport(). */
export function observeIpc(): void {
  try {
    if (!on()) return;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const command = ipcCommand(e.name);
        if (command) ipcCalls.set(command, (ipcCalls.get(command) ?? 0) + 1);
      }
    }).observe({ type: "resource", buffered: true });
  } catch {
    // Timing is optional
  }
}

// Renders per component (P3): the memoised components call perfRender(name) in their body, so the effect of an action (a key in the
// editor, a selection, a body batch, a drag frame, a ticked task) is a count read over the DevTools Protocol, not a guess. The
// preference is read once: it is switched on with a restart like the marks above, and a row renders thousands of times. A render
// that React starts and throws away (a transition that is interrupted) counts too.
const renders = new Map<string, number>();
const counting = on();

/** Counts one render of the component `name` (a no-op unless the preference is on). */
export function perfRender(name: string): void {
  if (counting) renders.set(name, (renders.get(name) ?? 0) + 1);
}

/** The render counts by component name so far. `reset`: start counting again from zero, so call it before an action and read it after. */
export function perfRenders(reset = false): Record<string, number> {
  const counts = Object.fromEntries(renders);
  if (reset) renders.clear();
  return counts;
}

/** One console table of all marks, then the long frames, the IPC calls and the renders when there are any. */
export function perfReport(): void {
  try {
    if (!on()) return;
    console.table(markRows(performance.getEntriesByType("mark")));
    if (longFrames.length) console.table(longFrames);
    if (ipcCalls.size)
      console.table(
        [...ipcCalls]
          .map(([command, calls]) => ({ command, calls }))
          .sort((a, b) => b.calls - a.calls),
      );
    if (renders.size)
      console.table(
        [...renders]
          .map(([component, count]) => ({ component, renders: count }))
          .sort((a, b) => b.renders - a.renders),
      );
  } catch {
    // Timing is optional
  }
}

// So they can be typed in the inspector (or evaluated over the DevTools Protocol)
if (on()) Object.assign(globalThis, { perfReport, perfRenders });
