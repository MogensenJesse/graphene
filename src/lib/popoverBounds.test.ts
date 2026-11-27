// src/lib/popoverBounds.test.ts
import { describe, expect, it } from "vitest";
import {
  type Bounds,
  placeAtPoint,
  placeBelow,
  placeBeside,
  pointBelow,
} from "./popoverBounds";

// The phone of the audit: 354 x 792 css px, a 40px status bar and a 44px navigation bar, and a 6px margin
const PHONE: Bounds = { left: 6, top: 46, right: 348, bottom: 742 };
// The same with the keyboard up: the window is 464 tall and the navigation bar is under the keyboard
const PHONE_KEYBOARD: Bounds = { left: 6, top: 46, right: 348, bottom: 458 };
const DESKTOP: Bounds = { left: 6, top: 6, right: 1274, bottom: 794 };

describe("placeAtPoint with a mouse", () => {
  it("starts at the point", () => {
    expect(
      placeAtPoint({ x: 100, y: 200 }, { width: 188, height: 150 }, DESKTOP),
    ).toEqual({ left: 100, top: 200, maxHeight: 788 });
  });

  it("is pulled back from the right and bottom edges", () => {
    const p = placeAtPoint(
      { x: 1200, y: 700 },
      { width: 188, height: 150 },
      DESKTOP,
    );
    expect(p.left).toBe(1274 - 188);
    expect(p.top).toBe(794 - 150);
  });

  it("keeps a low menu above the navigation bar", () => {
    // The note menu of the audit: 423 tall, opened at y 640, was drawn to 786 and its last row was under the bar
    const p = placeAtPoint(
      { x: 114, y: 640 },
      { width: 188, height: 423 },
      PHONE,
    );
    expect(p.top + 423).toBeLessThanOrEqual(PHONE.bottom);
    expect(p.top).toBe(742 - 423);
  });

  it("scrolls a menu taller than the area", () => {
    const p = placeAtPoint(
      { x: 114, y: 300 },
      { width: 188, height: 900 },
      PHONE,
    );
    expect(p.top).toBe(PHONE.top);
    expect(p.maxHeight).toBe(PHONE.bottom - PHONE.top);
  });
});

describe("placeAtPoint with a finger", () => {
  const menu = { width: 188, height: 150 };

  it("goes under the point when it fits there", () => {
    const p = placeAtPoint({ x: 100, y: 200 }, menu, PHONE, 24);
    expect(p.top).toBe(224);
  });

  it("goes over the point when only that side holds it", () => {
    const p = placeAtPoint({ x: 100, y: 700 }, menu, PHONE, 24);
    expect(p.top).toBe(700 - 24 - 150);
  });

  it("scrolls on the larger side when neither holds it, and stays off the word", () => {
    // The editor's text menu: 344 tall, pressed at y 314 with the keyboard up
    const p = placeAtPoint(
      { x: 114, y: 314 },
      { width: 188, height: 344 },
      PHONE_KEYBOARD,
      24,
    );
    expect(p.top).toBe(PHONE_KEYBOARD.top);
    expect(p.top + p.maxHeight).toBe(314 - 24);
  });

  it("covers the point when each side is too small to be of use", () => {
    // 330 tall in a 354 area, pressed in the middle: 153 px on each side, under the 176 that is worth scrolling in
    const bounds = { ...PHONE_KEYBOARD, bottom: 400 };
    const p = placeAtPoint(
      { x: 114, y: 223 },
      { width: 188, height: 330 },
      bounds,
      24,
    );
    expect(p.top).toBe(400 - 330);
    expect(p.maxHeight).toBe(354);
  });
});

describe("placeBeside", () => {
  const sub = { width: 188, height: 200 };

  it("opens on the right of its row when it fits", () => {
    const row = { left: 6, top: 100, right: 194, bottom: 130 };
    const p = placeBeside(row, sub, DESKTOP);
    expect(p.left).toBe(190);
    expect(p.top).toBe(95);
  });

  it("opens on the left of its row when only that side fits", () => {
    const row = { left: 1000, top: 100, right: 1188, bottom: 130 };
    const p = placeBeside(row, sub, DESKTOP);
    expect(p.left).toBe(1000 + 4 - 188);
  });

  it("cascades over its parent on a narrow screen instead of leaving it", () => {
    // The Color submenu of the audit: the parent at 160 to 348 on a 354px screen. It was drawn at -20
    const row = { left: 160, top: 600, right: 348, bottom: 640 };
    const p = placeBeside(row, { width: 188, height: 317 }, PHONE);
    expect(p.left).toBe(PHONE.left);
    expect(p.left + 188).toBeLessThanOrEqual(PHONE.right);
  });

  it("cascades from a parent that sits further left too", () => {
    // The Format submenu of the audit: the parent at 114 to 302. It was drawn at -66
    const row = { left: 114, top: 138, right: 302, bottom: 178 };
    const p = placeBeside(row, { width: 188, height: 320 }, PHONE_KEYBOARD);
    expect(p.left).toBeGreaterThanOrEqual(PHONE_KEYBOARD.left);
    expect(p.left + 188).toBeLessThanOrEqual(PHONE_KEYBOARD.right);
  });

  it("moves up to keep its last row above the navigation bar", () => {
    const row = { left: 160, top: 600, right: 348, bottom: 640 };
    const p = placeBeside(row, { width: 188, height: 317 }, PHONE);
    expect(p.top + 317).toBeLessThanOrEqual(PHONE.bottom);
  });

  it("scrolls one taller than the area", () => {
    const row = { left: 6, top: 300, right: 194, bottom: 330 };
    const p = placeBeside(row, { width: 188, height: 2000 }, PHONE);
    expect(p.top).toBe(PHONE.top);
    expect(p.maxHeight).toBe(PHONE.bottom - PHONE.top);
  });
});

describe("placeBelow", () => {
  const calendar = { width: 296, height: 318 };

  it("goes under its anchor when there is room", () => {
    const anchor = { left: 26, top: 232, right: 322, bottom: 268 };
    const p = placeBelow(anchor, calendar, PHONE, 4);
    expect(p).toMatchObject({ left: 26, top: 272, up: false });
  });

  it("goes over its anchor when there is more room there", () => {
    const anchor = { left: 26, top: 600, right: 322, bottom: 636 };
    const p = placeBelow(anchor, calendar, PHONE, 4);
    expect(p.up).toBe(true);
    expect(p.top).toBe(600 - 4 - 318);
  });

  it("moves up to be seen whole by a keyboard when neither side has the room", () => {
    // The add-task calendar with the keyboard up: 8 px short under the box, and no room over it
    const anchor = { left: 96, top: 104, right: 316, bottom: 144 };
    const p = placeBelow(anchor, calendar, PHONE_KEYBOARD, 4);
    expect(p.up).toBe(false);
    expect(p.top).toBe(PHONE_KEYBOARD.bottom - 318);
  });

  it("stays inside the area when its anchor has left it (a button under the keyboard)", () => {
    // The font list with the keyboard up: the button is at 664, in a window that is 464 tall
    const list = { width: 284, height: 400 };
    const gone = { left: 32, top: 664, right: 316, bottom: 694 };
    const p = placeBelow(gone, list, PHONE_KEYBOARD, 4, 200);
    expect(p).toMatchObject({ up: true, bottom: 458, maxHeight: 412 });
    expect(p.top).toBe(58);
    // And one scrolled off the top is not drawn under the status bar
    const high = { left: 32, top: -20, right: 316, bottom: 10 };
    expect(placeBelow(high, list, PHONE_KEYBOARD, 4, 200).top).toBe(46);
  });

  it("says where a box over its anchor ends, so a short one stays next to the button", () => {
    const anchor = { left: 32, top: 650, right: 316, bottom: 680 };
    const p = placeBelow(anchor, { width: 284, height: 100 }, PHONE, 4, 200);
    expect(p).toMatchObject({ up: true, bottom: 646, top: 546 });
  });

  it("keeps a list that may scroll under its button instead of lifting it over the button", () => {
    const list = { width: 284, height: 400 };
    const anchor = { left: 32, top: 456, right: 316, bottom: 486 };
    const p = placeBelow(anchor, list, PHONE, 4, 200);
    expect(p).toMatchObject({ top: 490, maxHeight: 252, up: false });
  });

  it("is pulled back inside from the right", () => {
    const anchor = { left: 300, top: 100, right: 340, bottom: 140 };
    const p = placeBelow(anchor, calendar, PHONE, 4);
    expect(p.left + 296).toBeLessThanOrEqual(PHONE.right);
  });

  it("gives a list the room under the button as its height, and opens over it below a minimum", () => {
    const list = { width: 284, height: 900 };
    const high = { left: 32, top: 456, right: 316, bottom: 486 };
    expect(placeBelow(high, list, PHONE, 4, 200).maxHeight).toBe(742 - 486 - 4);
    const low = { left: 32, top: 650, right: 316, bottom: 680 };
    const up = placeBelow(low, list, PHONE, 4, 200);
    expect(up.up).toBe(true);
    expect(up.maxHeight).toBe(650 - 4 - PHONE.top);
  });
});

describe("pointBelow", () => {
  it("is the button's left edge, just under its bottom edge", () => {
    const button = { getBoundingClientRect: () => ({ left: 120, bottom: 64 }) };
    expect(pointBelow(button as unknown as Element)).toEqual([120, 66]);
  });
});
