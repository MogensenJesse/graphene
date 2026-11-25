// src/lib/scrollbars.ts
// The visible thumb of the panes that scroll up and down. A native thumb cannot animate (Chromium ignores transitions
// on ::-webkit-scrollbar-*), so a pane marked `data-scrollbar` keeps its native bar, made invisible, which still holds
// the gutter and pages when the track is clicked, and gets a thumb of ours drawn over it: it grows and brightens under
// the pointer (see _Scrollbar.scss) and can be dragged. Any other scroller keeps the plain native thin bar.

const TRACK = 6; // px: the width of the native bar and of the thumb's grab area (mixins.custom-scrollbar)
const MIN_THUMB = 28; // px
const END = 2; // px kept free at each end of the track

export type Thumb = { size: number; offset: number };

/** Size and offset of the thumb in a track `track` px long; null when nothing scrolls. */
export function thumbMetrics(
  scrollTop: number,
  client: number,
  scroll: number,
  track: number,
): Thumb | null {
  if (scroll <= client + 1 || track <= 0) return null;
  const size = Math.min(track, Math.max(MIN_THUMB, (track * client) / scroll));
  const progress = Math.min(1, Math.max(0, scrollTop / (scroll - client)));
  return { size, offset: (track - size) * progress };
}

/** The scrollTop that a thumb dragged `dy` px from where it was grabbed (at `startTop`) stands for. */
export function scrollTopAfterDrag(
  startTop: number,
  dy: number,
  client: number,
  scroll: number,
  thumb: number,
  track: number,
): number {
  const room = track - thumb;
  if (room <= 0) return startTop;
  const top = startTop + (dy * (scroll - client)) / room;
  return Math.min(scroll - client, Math.max(0, top));
}

const attached = new Map<HTMLElement, () => void>(); // scroller -> its cleanup

function attach(el: HTMLElement): void {
  const host = el.parentElement;
  if (attached.has(el) || !host) return;

  // The thumb lives in the pane's own parent, so it is clipped, faded and hidden with the pane (a sidebar that slides shut)
  if (getComputedStyle(host).position === "static")
    host.style.position = "relative";
  const track = document.createElement("div");
  track.className = "sbar";
  const thumb = document.createElement("div");
  thumb.className = "sbar__thumb";
  track.append(thumb);
  host.append(track); // absolute, so it is no flex or grid item of the host
  el.setAttribute("data-scrollbar-on", "");

  let frame = 0;
  const draw = () => {
    frame = 0;
    const client = el.clientHeight;
    const length = client - 2 * END;
    const metrics =
      el.offsetParent === host
        ? thumbMetrics(el.scrollTop, client, el.scrollHeight, length)
        : null;
    track.hidden = !metrics;
    if (!metrics) return;
    track.style.top = `${el.offsetTop + END}px`;
    track.style.left = `${el.offsetLeft + el.offsetWidth - TRACK}px`;
    track.style.width = `${TRACK}px`;
    track.style.height = `${length}px`;
    thumb.style.height = `${metrics.size}px`;
    thumb.style.transform = `translateY(${metrics.offset}px)`;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  // Content that grows or shrinks moves the thumb: watch the pane and its children (a textarea has no children, it says so with `input`)
  const resize = new ResizeObserver(schedule);
  const watchChildren = () => {
    resize.disconnect();
    resize.observe(el);
    for (const child of el.children) resize.observe(child);
    schedule();
  };
  const mutations = new MutationObserver(watchChildren);
  mutations.observe(el, { childList: true });
  watchChildren();
  el.addEventListener("scroll", schedule, { passive: true });
  el.addEventListener("input", schedule);

  let drag: { y: number; top: number } | null = null;
  const end = () => {
    drag = null;
    thumb.removeAttribute("data-active");
  };
  thumb.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection, and the pane keeps its focus
    thumb.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, top: el.scrollTop };
    thumb.setAttribute("data-active", "");
  });
  thumb.addEventListener("pointermove", (e) => {
    if (!drag) return;
    el.scrollTop = scrollTopAfterDrag(
      drag.top,
      e.clientY - drag.y,
      el.clientHeight,
      el.scrollHeight,
      thumb.offsetHeight,
      el.clientHeight - 2 * END,
    );
  });
  thumb.addEventListener("pointerup", end);
  thumb.addEventListener("pointercancel", end);
  thumb.addEventListener("lostpointercapture", end);

  attached.set(el, () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
    el.removeEventListener("scroll", schedule);
    el.removeEventListener("input", schedule);
    el.removeAttribute("data-scrollbar-on");
    track.remove();
  });
}

/** Draws a thumb for every `[data-scrollbar]` element, now and as panes come and go. Call once, before the first render. */
export function initScrollbars(): void {
  const scan = (root: ParentNode) => {
    if (root instanceof HTMLElement && root.matches("[data-scrollbar]"))
      attach(root);
    for (const el of root.querySelectorAll<HTMLElement>("[data-scrollbar]"))
      attach(el);
  };
  new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node instanceof HTMLElement) scan(node);
    for (const [el, detach] of attached)
      if (!el.isConnected) {
        detach();
        attached.delete(el);
      }
  }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);
}
