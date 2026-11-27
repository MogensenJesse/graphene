// src/lib/popoverBounds.ts
// Where a popup (a menu, a calendar, a dropdown) may be drawn, and where in that area a box goes. The area is the window less what the
// system draws over it: the status bar and the navigation bar (a phone with three buttons covers the bottom 44px of the page, and a tap
// there presses its Home button) and, while it is up, the keyboard, which makes the window itself shorter. The placing is pure, so it is
// tested; only `visibleBounds` reads the page.

/** The area a popup may use, in window coordinates, the margin to the edges already taken off */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A DOMRect has these fields */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Where to put the box, and how tall it may be before it has to scroll */
export interface Placement {
  left: number;
  top: number;
  maxHeight: number;
}

export interface BelowPlacement extends Placement {
  /** Over the anchor instead of under it */
  up: boolean;
  /** Where the box ends: what a box hanging from its bottom edge (over its anchor) is placed by, so a shorter list stays next to the button */
  bottom: number;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(n, max));

/** The most a menu next to a finger may scroll in: less than this and it takes the whole area instead (and covers the word) */
const MIN_SCROLL_ROOM = 176;
/** A submenu starts a little above its row, so its first row lines up with it */
const ROW_RISE = 5;

/**
 * The part of the window a popup may use. `edge` is the margin kept to every side. On a computer the system draws nothing over the page, and
 * this is the window less the margin.
 */
export function visibleBounds(edge: number): Bounds {
  // The insets are CSS (`env()`), so they are read off a box that has them as its padding
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const inset = (value: string) => Number.parseFloat(value) || 0;
  const top = inset(style.paddingTop);
  const right = inset(style.paddingRight);
  const bottom = inset(style.paddingBottom);
  const left = inset(style.paddingLeft);
  probe.remove();
  return {
    left: left + edge,
    top: top + edge,
    right: window.innerWidth - right - edge,
    bottom: window.innerHeight - bottom - edge,
  };
}

/**
 * A menu opened at a point. With a mouse it starts at the point and is pulled back inside. With a finger (`clearance` is how far to stay from
 * the point, so the word that was pressed stays in sight) it goes under the point, or over it, whichever holds the whole menu; when neither
 * does, the larger side, scrolling, unless that side is too small to be of use.
 */
export function placeAtPoint(
  point: { x: number; y: number },
  size: Size,
  bounds: Bounds,
  clearance = 0,
): Placement {
  const room = bounds.bottom - bounds.top;
  const left = clamp(point.x, bounds.left, bounds.right - size.width);
  const whole = () => ({
    left,
    top: clamp(
      point.y,
      bounds.top,
      bounds.bottom - Math.min(size.height, room),
    ),
    maxHeight: room,
  });
  if (!clearance) return whole();

  const below = bounds.bottom - (point.y + clearance);
  const above = point.y - clearance - bounds.top;
  if (size.height <= below)
    return { left, top: point.y + clearance, maxHeight: below };
  if (size.height <= above)
    return { left, top: point.y - clearance - size.height, maxHeight: above };
  if (size.height <= room) {
    // It fits the area but not either side: scroll on the larger side if that is a usable height, else cover the point
    const side = Math.max(below, above);
    if (side < MIN_SCROLL_ROOM) return whole();
    return below >= above
      ? { left, top: point.y + clearance, maxHeight: below }
      : { left, top: bounds.top, maxHeight: above };
  }
  return below >= above
    ? { left, top: point.y + clearance, maxHeight: below }
    : { left, top: bounds.top, maxHeight: above };
}

/**
 * A submenu next to the row of its parent that opened it. It takes the right side if it fits, else the left side if it fits, else the side
 * with more room, as far in as the screen allows: on a narrow phone it cascades over its parent instead of leaving the screen. It starts at
 * the row's top and moves up as far as it must; one taller than the area scrolls. `overlap` is how far it reaches back over the parent.
 */
export function placeBeside(
  row: Rect,
  size: Size,
  bounds: Bounds,
  overlap = 4,
): Placement {
  const onRight = row.right - overlap;
  const onLeft = row.left + overlap - size.width;
  let left: number;
  if (onRight + size.width <= bounds.right) left = onRight;
  else if (onLeft >= bounds.left) left = onLeft;
  else {
    const roomRight = bounds.right - onRight;
    const roomLeft = row.left + overlap - bounds.left;
    left = roomLeft >= roomRight ? bounds.left : bounds.right - size.width;
  }
  left = clamp(left, bounds.left, bounds.right - size.width);

  const room = bounds.bottom - bounds.top;
  const height = Math.min(size.height, room);
  return {
    left,
    top: clamp(row.top - ROW_RISE, bounds.top, bounds.bottom - height),
    maxHeight: room,
  };
}

/**
 * A popover under the button that opened it, or over it when there is less than `minRoom` under it and more over it. `minRoom` is the least
 * the caller can do with: left at its default (the box's own height) the box is wanted whole, so one that does not fit under the anchor moves
 * up as far as it must (a calendar above a keyboard); with a smaller `minRoom` the box may scroll and stays put, never covering its anchor.
 * `maxHeight` is how tall it may be from its top.
 */
export function placeBelow(
  anchor: Rect,
  size: Size,
  bounds: Bounds,
  gap: number,
  minRoom = size.height,
): BelowPlacement {
  const below = bounds.bottom - anchor.bottom - gap;
  // An anchor that has left the area (the keyboard came up and its button is now under it) still leaves the area itself to be used
  const edge = Math.min(anchor.top - gap, bounds.bottom);
  const above = edge - bounds.top;
  const left = clamp(anchor.left, bounds.left, bounds.right - size.width);
  if (below < minRoom && above > below) {
    const height = Math.min(size.height, Math.max(0, above));
    return {
      left,
      top: edge - height,
      bottom: edge,
      maxHeight: Math.max(0, above),
      up: true,
    };
  }
  const lift =
    minRoom >= size.height &&
    size.height > below &&
    size.height <= bounds.bottom - bounds.top;
  const top = lift
    ? bounds.bottom - size.height
    : Math.max(bounds.top, anchor.bottom + gap);
  const maxHeight = Math.max(0, bounds.bottom - top);
  return {
    left,
    top,
    bottom: top + Math.min(size.height, maxHeight),
    maxHeight,
    up: false,
  };
}
