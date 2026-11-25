// src/lib/dragStore.ts
// What a drag shows on screen, kept outside React state so that a drag frame renders nothing (docs/plans/01-audit-fixes.md, P3).
// The pointer moves about 60 times a second, and each of those used to re-render the whole sidebar (or the whole app, for a task).
// Now two things are kept apart:
//   - the view (what is dragged, and which drop target the pointer is over) changes a few times per drag; components read the
//     part they draw through `useDragValue` (hooks/useDragToFolder), which re-renders them only when that part changes;
//   - the pointer goes to whoever follows it (the ghost), straight onto its element, never through React.

// Notes and tasks (and to-do lists) land next to any peer or as a whole on a container; folders and groups only among their siblings
export type DragKind = "item" | "folder" | "task" | "taskList" | "taskGroup";

/** What is dragged. A folder (or group) can only be put among its siblings: those whose parent id is `parent` ("" for the root). */
export interface DragSource {
  kind: DragKind;
  id: string;
  label: string;
  parent?: string;
}

export interface DragView {
  /** Null when nothing is being dragged. */
  source: DragSource | null;
  /**
   * undefined = no active target, null = the unfiled zone, string = a folder id (or the trash).
   * Only a note dropped as a whole has one: with a line showing, or for a folder, there is no tint.
   */
  overId: string | null | undefined;
}

export interface Pointer {
  x: number;
  y: number;
}

export const AT_REST: DragView = { source: null, overId: undefined };

export interface DragStore {
  get: () => DragView;
  /** Replaces the view; listeners hear of it only when the source or the target is not the same as before. */
  set: (next: DragView) => void;
  subscribe: (listener: () => void) => () => void;
  /** Where the pointer was last (the ghost starts there). */
  pointer: () => Pointer;
  /** Moves the pointer: only the followers hear of it. */
  movePointer: (x: number, y: number) => void;
  follow: (follower: (at: Pointer) => void) => () => void;
}

export function createDragStore(): DragStore {
  let view = AT_REST;
  let at: Pointer = { x: 0, y: 0 };
  const listeners = new Set<() => void>();
  const followers = new Set<(at: Pointer) => void>();
  return {
    get: () => view,
    set(next) {
      if (next.source === view.source && next.overId === view.overId) return;
      view = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pointer: () => at,
    movePointer(x, y) {
      at = { x, y };
      for (const follower of [...followers]) follower(at);
    },
    follow(follower) {
      followers.add(follower);
      return () => {
        followers.delete(follower);
      };
    },
  };
}
