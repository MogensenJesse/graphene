// src/lib/focusTrap.ts
// What a dialog needs to keep the keyboard to itself: where Tab goes at the ends of the dialog (pure, see
// focusTrap.test.ts), the controls Tab can reach, and the page behind made inert while a dialog is open.

/**
 * Where Tab should send the focus so it never leaves a dialog, or null when the browser's own step stays inside.
 * `count` is the number of controls Tab can reach in the dialog and `at` the index of the focused one (-1: none of
 * them, like the dialog's own frame or the page). "panel" means the dialog has no control: keep the focus on it.
 */
export function tabTarget(
  count: number,
  at: number,
  back: boolean,
): number | "panel" | null {
  if (count === 0) return "panel";
  if (at === -1) return back ? count - 1 : 0;
  if (back && at === 0) return count - 1;
  if (!back && at === count - 1) return 0;
  return null;
}

const CONTROLS =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

/** The controls of `root` that Tab stops on, in order: not disabled, not tabindex -1, not hidden. */
export function tabStops(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CONTROLS)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.matches(":disabled") &&
      el.getClientRects().length > 0,
  );
}

/** Whether a dialog is open: the global shortcuts and the keys of the page behind it stand down. */
export const modalOpen = () =>
  document.querySelector('[aria-modal="true"]') !== null;

let locks = 0;

/**
 * Makes the app window (`.app`) inert while a dialog is open: no Tab, no click and no screen reader reaches what is
 * behind it. Dialogs, menus and the error toast render outside `.app`, so they stay live. Returns the release; the
 * page stays inert until every dialog has released it. A vault switch swaps the `.app` element while Settings stays
 * open, so the new one is made inert too.
 */
export function lockApp(): () => void {
  const apply = () =>
    document.querySelector(".app")?.toggleAttribute("inert", locks > 0);
  const root = document.getElementById("root");
  const watch = new MutationObserver(apply);
  if (root) watch.observe(root, { childList: true });
  locks++;
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    watch.disconnect();
    locks--;
    apply();
  };
}
