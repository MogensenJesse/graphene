// src/lib/backStack.ts
// What the Android Back key closes. Whatever is open (a menu, a dialog, the drawer, the details pane, the find box, the editor)
// registers a step here while it is open, newest last; Back runs the newest one, and with none left it leaves the app.

interface Step {
  run: () => void;
}

const steps: Step[] = [];

/** Registers a step; returns the function that takes it off again */
export function pushBack(run: () => void): () => void {
  const step = { run };
  steps.push(step);
  return () => {
    const at = steps.indexOf(step);
    if (at >= 0) steps.splice(at, 1);
  };
}

/** Runs the newest step. False when nothing is open, so Back should leave the app */
export function runBack(): boolean {
  const step = steps[steps.length - 1];
  if (!step) return false;
  step.run();
  return true;
}
