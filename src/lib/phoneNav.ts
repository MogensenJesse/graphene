// src/lib/phoneNav.ts
// What the sidebar is, and what Back does, at each window size. One flag, `listShowing`, serves two models: on a phone (a touch screen under
// 600px) the sidebar is the list screen, the home of the app, and the note, the editor, the Trash and the tasks are screens above it; in a
// small window (up to 799px) it is a drawer that floats over the note; in a wide one it is a panel the user shows or hides (`wideHidden`).
// Pure, so it is tested.

export interface NavState {
  /** Narrower than the wide layout: a phone, or a small window */
  compact: boolean;
  phone: boolean;
  /** The list (a phone) or the drawer (a small window) is showing */
  listShowing: boolean;
  /** The user's choice in a wide window */
  wideHidden: boolean;
}

export interface NavView {
  /** The drawer is open over the note */
  floating: boolean;
  sidebarHidden: boolean;
  /** A phone shows a screen above the list: Back, and the back arrow, go to the list */
  onScreen: boolean;
  /** A phone shows the list: it covers the screens, whose Back steps wait until they are shown again */
  onList: boolean;
}

export function navView({
  compact,
  phone,
  listShowing,
  wideHidden,
}: NavState): NavView {
  return {
    floating: compact && listShowing,
    sidebarHidden: compact ? !listShowing : wideHidden,
    onScreen: phone && !listShowing,
    onList: phone && listShowing,
  };
}
