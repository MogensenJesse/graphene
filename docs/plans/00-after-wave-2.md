# Startup after wave 2

Status: measured 2026-11-23 on a release build of the tree with wave 2 in it (uncommitted), with the method of
[00-baseline.md](00-baseline.md). That file is the "before" and is unchanged. Each cell is the median of 3 launches, with the minimum
and maximum in brackets.

## What was built and what changed

- Tree: HEAD `b511468` plus 148 uncommitted paths. Built with `npm run build:mcp`, `npm run pack:mcpb`, `npm run build`, then
  `cargo build --release --features tauri/custom-protocol --offline` in `src-tauri`.
- Rust `scan_vault` and `read_notes` replace the per-file reads; `boot_config` replaces three config calls; the window is created hidden and
  shown by the page once the first scan is adopted (`window-shown`), with a 3 s safety net in Rust; Settings, Update, Search and the
  Markdown renderer are lazy chunks.
- Frontend: entry chunk 376 KB (116 KB gzip) against 738 KB (226 KB gzip), plus a lazy Markdown chunk of 322 KB; CSS 81 KB against 89 KB.
- Release profile: fat LTO, one codegen unit, `opt-level = "s"`, `panic = "abort"`, `strip`. `graphene.exe` is 5.76 MB (was
  15.18 MB). The cargo build took 319 s (5 min 18 s) offline, while the vaults were being generated and one probe launch ran, so it is an upper bound.
  `src-tauri/target/release` is now 5.1 GB.
- The tree also has `src/lib/scrollbars.ts` and the other wave 1 changes of the baseline.

The marks changed meaning, so a row is not the same thing as in the baseline:

| Mark | Before | After |
|---|---|---|
| `scan-done` | the walk and the trash read (JS) | `scan_vault` returned |
| `items-set` | after every body was read | the metadata was committed |
| `first-populated-paint` | after every body was read | the first frame with the list (metadata only) |
| `bodies-read` | before `items-set` | last: the final body batch landed |
| `window-shown` | none | the `show()` call came back to the page |

## Method differences from the baseline

Same machine, same vault generator and presets, same release flags, same temp WebView2 profile and extra browser flags, same driver
logic (3 launches per size, a throw-away launch first that sets `graphene.perf`, a fresh process per measured launch). Changed:

- The driver waits for both `first-populated-paint` and `bodies-read` (up to 180 s) instead of a fixed 9 s, snapshots at each, and settles until 2 s after
  `bodies-read` and at least 9 s after the page load (so the 5 s update check is in).
- Long frames are split into before first paint, first paint to `bodies-read`, and after it.
- The window is watched from outside: a separate PowerShell process polls `IsWindowVisible` for the app's own top-level windows
  (larger than 50 by 50 pixels) about every 15 ms, on the same system clock as the process creation time. It touches nothing in the app.
  The error is the poll interval.
- WebView2 memory: the working set and private bytes of the app and of the WebView2 processes started with the temp profile, at the end.
- A control: the old exe (the baseline build, copied before it was rebuilt) was run today with the same driver and watcher on 1k and 5k.

## Headline (median, ms from process start unless said)

| | 1k | 5k | 20k | 50k |
|---|---|---|---|---|
| window visible, before (old exe, control) | 58 | 65 | not run | not run |
| window visible, after | 580 | 848 | 2146 | 3358 |
| first-populated-paint, before (baseline) | 3456 | 8149 | 27717 | 71127 |
| first-populated-paint, after | 557 | 850 | 2185 | 7732 |
| bodies-read, before (baseline; it came before the paint) | 3404 | 7898 | 26476 | 65153 |
| bodies-read, after (it comes after the paint) | 819 | 1874 | 5520 | 21973 |
| long frames, count / total ms, before | 1 / 50 | 1 / 243 | 1 / 1201 | 2 / 5901 |
| long frames, count / total ms, after | 1 / 59 | 1 / 243 | 8 / 1756 | 10 / 14372 |
| IPC calls in total, before | 1588 | 5788 | 21538 | 53038 |
| IPC calls in total, after | 41 | 54 | 57 | 62 |
| JS heap after loading, `usedJSHeapSize` MB, before | 30 | 72 | 182 | 432 |
| JS heap after loading, `usedJSHeapSize` MB, after | 37 | 104 | 526 | 637 |

The window used to be visible and empty from about 60 ms (the old exe creates it visible); it now appears with the list in it, later. At
50k it is not so, see below.

## What got worse

1. The window appears later: 58 and 65 ms before, 580, 848, 2146 and 3358 ms after (1k, 5k, 20k, 50k). By design, it is shown when
   the list is painted, which is now 557 to 2185 ms at 1k to 20k.
2. At 50k the window is shown by the 3 s Rust safety net at 3.36 s, not by the page: the page's main thread is inside a 5.6 s long frame (the first render of
   480k DOM elements), so the window is up 4.4 s before the list is painted (7.7 s) and does not answer in between. What is on screen
   in that time was not looked at.
3. Jank while the bodies stream in. Each batch commit re-renders the whole list. 1k and 5k: none. 20k: 8 long frames, 1.76 s in total,
   against 1 frame of 1.2 s before; 2 of them (134 ms) between first paint and `bodies-read`, 4 more (384 ms, longest 131 ms) just after it. 50k: 10 long frames, 14.4 s in
   total, against 2 frames and 5.9 s before; 8 of them (8.3 s, the longest 4.3 s) fall between first paint and `bodies-read`.
4. Memory after loading is higher from 5k up. `usedJSHeapSize` after settling: 104 MB at 5k (before 58 to 72), 526 MB at 20k (before 182),
   637 MB at 50k (before 432); `Runtime.getHeapUsage` 99, 414 and 581 MB (before 19 to 33, 66, 158). The renderer's working set at 5k is 384 MB
   against 276 MB for the old exe today; at 20k and 50k it is 1.2 GB and 2.0 GB (the old build's was not measured at those sizes).
   At 1k the heap is also a little higher (37 against 30 MB). The cause was not looked into. At first paint the heap is lower (a third
   to 43% less at every size).

## Before and after, by size

Before = `docs/plans/00-baseline.md` (measured 2026-11-22, no window watcher, the old exe). Control = the same old exe run today with the same driver and window watcher as the new build (1k and 5k only; 20k and 50k not run). After = wave 2. Milliseconds unless a row says otherwise; median of 3, and for After the minimum and maximum in brackets.

### 1k (1000 notes)

| | Before (baseline) | Control (old exe today) | After (wave 2) |
|---|---|---|---|
| process start to page load | 314 | 309 | 297 (279 to 303) |
| process start to window visible | not measured | 58 | 580 (540 to 588) |
| window visible minus first-populated-paint (negative: the window was up before the list) | not measured | -3633 | 23 (3 to 23) |
| process start to first-populated-paint | 3456 | 3690 | 557 (537 to 566) |
| process start to bodies-read (old: before the paint; new: after it) | 3404 | 3629 | 819 (784 to 884) |
| long frames, all of them: count / total ms / longest ms | 1 / 50 / 50 | 1 / 56 / 56 | 1 / 59 / 59 |
| long frames between first paint and bodies-read: count / total ms / longest ms | none possible (the bodies came first) | none possible | 0 / 0 / 0 |
| IPC calls in total, at the end | 1588 | 1588 | 41 (41 to 42) |
| JS heap at first paint, usedJSHeapSize MB | 25.2 | 25.3 | 16.9 (8.4 to 17.8) |
| JS heap after loading and settling, usedJSHeapSize MB | 30 | 30.1 | 37 (28.9 to 37) |
| JS heap after loading and settling, Runtime.getHeapUsage MB | 12.5 | 12.6 | 34.2 (28.2 to 36.3) |
| DOM elements at first paint | 9823 | 9823 | 9826 (9826 to 9826) |
| DOM elements after settling | 9823 | 9823 | 9826 (9826 to 9877) |
| WebView2 renderer working set at the end, MB | not measured | 149 | 150 (147 to 180) |
| WebView2 processes and app, working set at the end, MB | not measured | 532 | 504 (498 to 564) |

### 5k (5000 notes)

| | Before (baseline) | Control (old exe today) | After (wave 2) |
|---|---|---|---|
| process start to page load | 300 | 322 | 281 (276 to 287) |
| process start to window visible | not measured | 65 | 848 (846 to 860) |
| window visible minus first-populated-paint (negative: the window was up before the list) | not measured | -11071 | -4 (-6 to -2) |
| process start to first-populated-paint | 8149 | 11135 | 850 (849 to 866) |
| process start to bodies-read (old: before the paint; new: after it) | 7898 | 10713 | 1874 (1817 to 1880) |
| long frames, all of them: count / total ms / longest ms | 1 / 243 / 234 | 1 / 405 / 405 | 1 / 243 / 243 |
| long frames between first paint and bodies-read: count / total ms / longest ms | none possible (the bodies came first) | none possible | 0 / 0 / 0 |
| IPC calls in total, at the end | 5788 | 5788 | 54 (54 to 73) |
| JS heap at first paint, usedJSHeapSize MB | 58.7 | 57.6 | 33.3 (33.3 to 35) |
| JS heap after loading and settling, usedJSHeapSize MB | 72.4 | 57.7 | 103.8 (95.5 to 105.9) |
| JS heap after loading and settling, Runtime.getHeapUsage MB | 33.1 | 19.3 | 98.8 (94.6 to 103.7) |
| DOM elements at first paint | 48273 | 48273 | 48276 (48276 to 48276) |
| DOM elements after settling | 48273 | 48273 | 48276 (48276 to 48276) |
| WebView2 renderer working set at the end, MB | not measured | 276 | 384 (380 to 387) |
| WebView2 processes and app, working set at the end, MB | not measured | 644 | 739 (738 to 758) |

### 20k (20000 notes)

| | Before (baseline) | Control (old exe today) | After (wave 2) |
|---|---|---|---|
| process start to page load | 300 | not run | 311 (276 to 320) |
| process start to window visible | not measured | not run | 2146 (2136 to 2155) |
| window visible minus first-populated-paint (negative: the window was up before the list) | not measured | not run | -30 (-59 to -30) |
| process start to first-populated-paint | 27717 | not run | 2185 (2176 to 2195) |
| process start to bodies-read (old: before the paint; new: after it) | 26476 | not run | 5520 (5394 to 5568) |
| long frames, all of them: count / total ms / longest ms | 1 / 1201 / 1201 | not run | 8 / 1756 / 1091 |
| long frames between first paint and bodies-read: count / total ms / longest ms | none possible (the bodies came first) | none possible | 2 / 134 / 61 |
| IPC calls in total, at the end | 21538 | not run | 57 (57 to 57) |
| JS heap at first paint, usedJSHeapSize MB | 182.3 | not run | 120.2 (120.1 to 120.2) |
| JS heap after loading and settling, usedJSHeapSize MB | 182.3 | not run | 526 (520.1 to 575.7) |
| JS heap after loading and settling, Runtime.getHeapUsage MB | 65.7 | not run | 413.5 (407.6 to 463.2) |
| DOM elements at first paint | 192257 | not run | 192260 (192260 to 192260) |
| DOM elements after settling | 192257 | not run | 192260 (192260 to 192260) |
| WebView2 renderer working set at the end, MB | not measured | not run | 1172 (1162 to 1217) |
| WebView2 processes and app, working set at the end, MB | not measured | not run | 1530 (1527 to 1579) |

### 50k (50000 notes)

| | Before (baseline) | Control (old exe today) | After (wave 2) |
|---|---|---|---|
| process start to page load | 308 | not run | 296 (279 to 367) |
| process start to window visible | not measured | not run | 3358 (3315 to 3435) |
| window visible minus first-populated-paint (negative: the window was up before the list) | not measured | not run | -4417 (-4480 to -3637) |
| process start to first-populated-paint | 71127 | not run | 7732 (7073 to 7838) |
| process start to bodies-read (old: before the paint; new: after it) | 65153 | not run | 21973 (20139 to 23683) |
| long frames, all of them: count / total ms / longest ms | 2 / 5901 / 5840 | not run | 10 / 14372 / 5676 |
| long frames between first paint and bodies-read: count / total ms / longest ms | none possible (the bodies came first) | none possible | 8 / 8284 / 4290 |
| IPC calls in total, at the end | 53038 | not run | 62 (62 to 62) |
| JS heap at first paint, usedJSHeapSize MB | 431.5 | not run | 289.5 (289.5 to 289.7) |
| JS heap after loading and settling, usedJSHeapSize MB | 431.5 | not run | 637.1 (610.4 to 637.6) |
| JS heap after loading and settling, Runtime.getHeapUsage MB | 158.5 | not run | 580.9 (580.2 to 587.4) |
| DOM elements at first paint | 480317 | not run | 480320 (480320 to 480320) |
| DOM elements after settling | 480317 | not run | 480320 (480320 to 480320) |
| WebView2 renderer working set at the end, MB | not measured | not run | 2019 (2009 to 2067) |
| WebView2 processes and app, working set at the end, MB | not measured | not run | 2353 (2350 to 2407) |

## Details by vault size

A step is the time between a mark and the one before it, in the order the marks came (by median).

### 1k (1000 notes, 3 launches)

| Mark | ms since page load: median (min to max) | step from the previous mark: median (min to max) |
|---|---|---|
| process start to page load (Rust + WebView2, not a mark) | 297 (279 to 303) | |
| main | 85.7 (81.4 to 90) |  |
| config-ready | 97.1 (92.6 to 101.7) | 11.4 (11.2 to 11.7) |
| scan-done | 177.4 (176.8 to 181.3) | 80.3 (79.6 to 84.2) |
| items-set | 179.5 (178.4 to 183) | 1.7 (1.6 to 2.1) |
| first-populated-paint | 260 (258.3 to 262.4) | 78.8 (77 to 84) |
| window-shown | 287.6 (279.7 to 290.7) | 27.6 (21.4 to 28.3) |
| bodies-read | 521.7 (504.9 to 580.9) | 234.1 (225.2 to 290.2) |
| process start to window visible (watched from outside, not a mark) | 580 (540 to 588) | |
| process start to first-populated-paint | 557 (537 to 566) | |
| process start to bodies-read | 819 (784 to 884) | |

Marks order by median: main, config-ready, scan-done, items-set, first-populated-paint, window-shown, bodies-read. Window size at first sight: 1550x926. first-paint 148 (144 to 148) ms, first-contentful-paint 148 (144 to 148) ms.

| Memory | at first paint | at bodies-read | about 2 s after bodies-read (and at least 9 s after load) |
|---|---|---|---|
| JS heap, `usedJSHeapSize` MB | 16.9 (8.4 to 17.8) | 39.5 (24.4 to 46) | 37 (28.9 to 37) |
| JS heap, `Runtime.getHeapUsage` MB | 16.5 (14.5 to 16.6) | 29.8 (23.8 to 38.4) | 34.2 (28.2 to 36.3) |
| DOM elements | 9826 (9826 to 9826) | 9826 (9826 to 9877) | 9826 (9826 to 9877) |
| WebView2 renderer working set MB (end) | | | 150 (147 to 180) |
| WebView2 processes and app, working set MB (end) | | | 504 (498 to 564) |
| WebView2 processes and app, private bytes MB (end) | | | 284 (279 to 341) |

| Long frames (over 50 ms) | count | total ms | longest ms | blocking ms |
|---|---|---|---|---|
| before first paint | 1 (1 to 1) | 59 (58 to 63) | 59 (58 to 63) | 0 (0 to 0) |
| first paint to bodies-read | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |
| after bodies-read (to about 2 s later) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |
| all | 1 (1 to 1) | 59 (58 to 63) | 59 (58 to 63) | 0 (0 to 0) |

| IPC command | at first paint (median, min to max) | at bodies-read | about 2 s later |
|---|---|---|---|
| `plugin:event\|listen` | 10 (10 to 10) | 10 (10 to 10) | 10 (10 to 10) |
| `plugin:fs\|exists` | 9 (9 to 9) | 9 (9 to 9) | 9 (9 to 9) |
| `plugin:fs\|read_text_file` | 9 (9 to 9) | 9 (9 to 9) | 9 (9 to 9) |
| `read_notes` | 0 (0 to 0) | 4 (4 to 5) | 4 (4 to 5) |
| `plugin:window\|is_maximized` | 3 (1 to 3) | 3 (3 to 3) | 3 (3 to 3) |
| `plugin:window\|set_theme` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:app\|version` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `boot_config` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `scan_vault` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:window\|show` | 1 (0 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:updater\|check` | 0 (0 to 0) | 0 (0 to 0) | 1 (1 to 1) |
| total | 36 (33 to 36) | 40 (40 to 41) | 41 (41 to 42) |

Each launch, process start to window visible / first-populated-paint / bodies-read, ms: 580 / 557 / 819; 540 / 537 / 784; 588 / 566 / 884

### 5k (5000 notes, 3 launches)

| Mark | ms since page load: median (min to max) | step from the previous mark: median (min to max) |
|---|---|---|
| process start to page load (Rust + WebView2, not a mark) | 281 (276 to 287) | |
| main | 82.8 (82.1 to 86.8) |  |
| config-ready | 94.6 (92.5 to 97) | 10.4 (10.2 to 11.8) |
| scan-done | 277.8 (265.9 to 278.7) | 181.7 (173.4 to 183.2) |
| items-set | 283.1 (271.1 to 284.3) | 5.3 (5.2 to 5.6) |
| first-populated-paint | 573.7 (568.2 to 578.9) | 294.6 (290.6 to 297.1) |
| window-shown | 575.1 (572 to 583.4) | 3.8 (1.4 to 4.5) |
| bodies-read | 1593.1 (1536 to 1597.7) | 1009.7 (964 to 1022.6) |
| process start to window visible (watched from outside, not a mark) | 848 (846 to 860) | |
| process start to first-populated-paint | 850 (849 to 866) | |
| process start to bodies-read | 1874 (1817 to 1880) | |

Marks order by median: main, config-ready, scan-done, items-set, first-populated-paint, window-shown, bodies-read. Window size at first sight: 1550x926. first-paint 152 (136 to 152) ms, first-contentful-paint 152 (136 to 152) ms.

| Memory | at first paint | at bodies-read | about 2 s after bodies-read (and at least 9 s after load) |
|---|---|---|---|
| JS heap, `usedJSHeapSize` MB | 33.3 (33.3 to 35) | 153.5 (80.2 to 159.2) | 103.8 (95.5 to 105.9) |
| JS heap, `Runtime.getHeapUsage` MB | 34.3 (34.3 to 36) | 69.4 (67.2 to 77.8) | 98.8 (94.6 to 103.7) |
| DOM elements | 48276 (48276 to 48276) | 48276 (48276 to 48276) | 48276 (48276 to 48276) |
| WebView2 renderer working set MB (end) | | | 384 (380 to 387) |
| WebView2 processes and app, working set MB (end) | | | 739 (738 to 758) |
| WebView2 processes and app, private bytes MB (end) | | | 521 (518 to 542) |

| Long frames (over 50 ms) | count | total ms | longest ms | blocking ms |
|---|---|---|---|---|
| before first paint | 1 (1 to 1) | 243 (241 to 248) | 243 (241 to 248) | 143 (141 to 148) |
| first paint to bodies-read | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |
| after bodies-read (to about 2 s later) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |
| all | 1 (1 to 1) | 243 (241 to 248) | 243 (241 to 248) | 143 (141 to 148) |

| IPC command | at first paint (median, min to max) | at bodies-read | about 2 s later |
|---|---|---|---|
| `read_notes` | 0 (0 to 0) | 17 (17 to 17) | 17 (17 to 17) |
| `plugin:event\|listen` | 10 (10 to 10) | 10 (10 to 10) | 10 (10 to 10) |
| `plugin:fs\|exists` | 9 (9 to 9) | 9 (9 to 9) | 9 (9 to 19) |
| `plugin:fs\|read_text_file` | 9 (9 to 9) | 9 (9 to 9) | 9 (9 to 18) |
| `plugin:window\|is_maximized` | 1 (1 to 1) | 3 (3 to 3) | 3 (3 to 3) |
| `plugin:window\|set_theme` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `boot_config` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:app\|version` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `scan_vault` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:window\|show` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:updater\|check` | 0 (0 to 0) | 0 (0 to 0) | 1 (1 to 1) |
| total | 34 (34 to 34) | 53 (53 to 53) | 54 (54 to 73) |

Each launch, process start to window visible / first-populated-paint / bodies-read, ms: 860 / 866 / 1880; 846 / 849 / 1817; 848 / 850 / 1874

### 20k (20000 notes, 3 launches)

| Mark | ms since page load: median (min to max) | step from the previous mark: median (min to max) |
|---|---|---|
| process start to page load (Rust + WebView2, not a mark) | 311 (276 to 320) | |
| main | 84.5 (81.3 to 88.6) |  |
| config-ready | 96.5 (93 to 99.4) | 11.7 (10.8 to 12) |
| scan-done | 591.9 (590.1 to 612.9) | 497.1 (495.4 to 513.5) |
| items-set | 608.6 (607.1 to 629.9) | 17 (16.7 to 17) |
| first-populated-paint | 1874.4 (1873.9 to 1900.5) | 1267.3 (1265.3 to 1270.6) |
| window-shown | 1902 (1882.6 to 1905.5) | 8.7 (5 to 27.6) |
| bodies-read | 5244.6 (5073.4 to 5257) | 3339.1 (3171.4 to 3374.4) |
| process start to window visible (watched from outside, not a mark) | 2146 (2136 to 2155) | |
| process start to first-populated-paint | 2185 (2176 to 2195) | |
| process start to bodies-read | 5520 (5394 to 5568) | |

Marks order by median: main, config-ready, scan-done, items-set, first-populated-paint, window-shown, bodies-read. Window size at first sight: 1550x926. first-paint 140 (140 to 140) ms, first-contentful-paint 140 (140 to 140) ms.

| Memory | at first paint | at bodies-read | about 2 s after bodies-read (and at least 9 s after load) |
|---|---|---|---|
| JS heap, `usedJSHeapSize` MB | 120.2 (120.1 to 120.2) | 457 (446.7 to 486.7) | 526 (520.1 to 575.7) |
| JS heap, `Runtime.getHeapUsage` MB | 123 (122.7 to 126.4) | 347 (344.7 to 375.2) | 413.5 (407.6 to 463.2) |
| DOM elements | 192260 (192260 to 192260) | 192260 (192260 to 192260) | 192260 (192260 to 192260) |
| WebView2 renderer working set MB (end) | | | 1172 (1162 to 1217) |
| WebView2 processes and app, working set MB (end) | | | 1530 (1527 to 1579) |
| WebView2 processes and app, private bytes MB (end) | | | 1314 (1312 to 1363) |

| Long frames (over 50 ms) | count | total ms | longest ms | blocking ms |
|---|---|---|---|---|
| before first paint | 2 (2 to 2) | 1229 (1228 to 1233) | 1091 (1070 to 1091) | 1079 (1078 to 1082) |
| first paint to bodies-read | 2 (1 to 3) | 134 (58 to 167) | 61 (58 to 73) | 17 (0 to 26) |
| after bodies-read (to about 2 s later) | 4 (4 to 4) | 384 (383 to 394) | 131 (131 to 144) | 184 (177 to 194) |
| all | 8 (7 to 9) | 1756 (1669 to 1782) | 1091 (1070 to 1091) | 1275 (1261 to 1298) |

| IPC command | at first paint (median, min to max) | at bodies-read | about 2 s later |
|---|---|---|---|
| `read_notes` | 0 (0 to 1) | 20 (20 to 20) | 20 (20 to 20) |
| `plugin:event\|listen` | 10 (10 to 10) | 10 (10 to 10) | 10 (10 to 10) |
| `plugin:fs\|exists` | 9 (9 to 9) | 9 (9 to 9) | 9 (9 to 9) |
| `plugin:fs\|read_text_file` | 9 (9 to 9) | 9 (9 to 9) | 9 (9 to 9) |
| `plugin:window\|is_maximized` | 1 (1 to 1) | 3 (3 to 3) | 3 (3 to 3) |
| `plugin:window\|set_theme` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `boot_config` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:app\|version` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `scan_vault` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:window\|show` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:updater\|check` | 0 (0 to 0) | 0 (0 to 0) | 1 (1 to 1) |
| total | 34 (34 to 35) | 56 (56 to 56) | 57 (57 to 57) |

Each launch, process start to window visible / first-populated-paint / bodies-read, ms: 2146 / 2176 / 5520; 2136 / 2195 / 5394; 2155 / 2185 / 5568

### 50k (50000 notes, 3 launches)

| Mark | ms since page load: median (min to max) | step from the previous mark: median (min to max) |
|---|---|---|
| process start to page load (Rust + WebView2, not a mark) | 296 (279 to 367) | |
| main | 85 (75.8 to 86.5) |  |
| config-ready | 96.9 (86.3 to 97.5) | 11 (10.5 to 11.9) |
| scan-done | 1276.6 (1268 to 1307.5) | 1190.3 (1170.5 to 1210.6) |
| items-set | 1318.5 (1308.9 to 1347.7) | 40.9 (40.2 to 41.9) |
| first-populated-paint | 7453 (6705.2 to 7542.3) | 6134.5 (5396.3 to 6194.6) |
| window-shown | 7494.2 (6707.9 to 7581.9) | 39.6 (2.7 to 41.2) |
| bodies-read | 21677.1 (19771.5 to 23403.7) | 14095.2 (13063.6 to 15909.5) |
| process start to window visible (watched from outside, not a mark) | 3358 (3315 to 3435) | |
| process start to first-populated-paint | 7732 (7073 to 7838) | |
| process start to bodies-read | 21973 (20139 to 23683) | |

Marks order by median: main, config-ready, scan-done, items-set, first-populated-paint, window-shown, bodies-read. Window size at first sight: 1550x926. first-paint 140 (120 to 148) ms, first-contentful-paint 140 (120 to 148) ms.

| Memory | at first paint | at bodies-read | about 2 s after bodies-read (and at least 9 s after load) |
|---|---|---|---|
| JS heap, `usedJSHeapSize` MB | 289.5 (289.5 to 289.7) | 620.2 (577.4 to 622.2) | 637.1 (610.4 to 637.6) |
| JS heap, `Runtime.getHeapUsage` MB | 298.3 (298.3 to 298.6) | 563.4 (554.5 to 565.4) | 580.9 (580.2 to 587.4) |
| DOM elements | 480320 (480320 to 480320) | 480320 (480320 to 480320) | 480320 (480320 to 480320) |
| WebView2 renderer working set MB (end) | | | 2019 (2009 to 2067) |
| WebView2 processes and app, working set MB (end) | | | 2353 (2350 to 2407) |
| WebView2 processes and app, private bytes MB (end) | | | 2137 (2135 to 2194) |

| Long frames (over 50 ms) | count | total ms | longest ms | blocking ms |
|---|---|---|---|---|
| before first paint | 2 (2 to 2) | 6013 (5311 to 6088) | 5621 (5058 to 5676) | 5863 (5161 to 5937) |
| first paint to bodies-read | 8 (7 to 8) | 8284 (6945 to 9778) | 4290 (4131 to 6172) | 7874 (6595 to 9338) |
| after bodies-read (to about 2 s later) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |
| all | 10 (9 to 10) | 14372 (12256 to 15791) | 5676 (5058 to 6172) | 13811 (11756 to 15201) |

| IPC command | at first paint (median, min to max) | at bodies-read | about 2 s later |
|---|---|---|---|
| `read_notes` | 0 (0 to 1) | 25 (25 to 25) | 25 (25 to 25) |
| `plugin:event\|listen` | 10 (10 to 10) | 10 (10 to 10) | 10 (10 to 10) |
| `plugin:fs\|exists` | 9 (9 to 9) | 9 (9 to 9) | 9 (9 to 9) |
| `plugin:fs\|read_text_file` | 9 (9 to 9) | 9 (9 to 9) | 9 (9 to 9) |
| `plugin:window\|is_maximized` | 3 (2 to 3) | 3 (3 to 3) | 3 (3 to 3) |
| `plugin:window\|set_theme` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:app\|version` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `boot_config` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `scan_vault` | 1 (1 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:window\|show` | 1 (0 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:updater\|check` | 0 (0 to 1) | 1 (1 to 1) | 1 (1 to 1) |
| total | 36 (34 to 38) | 62 (62 to 62) | 62 (62 to 62) |

Each launch, process start to window visible / first-populated-paint / bodies-read, ms: 3315 / 7732 / 23683; 3435 / 7073 / 20139; 3358 / 7838 / 21973

## What the numbers show

1. Before first paint the work is now the scan call (`scan_vault`: 80 ms at 1k, 182 at 5k, 497 at 20k, 1190 at 50k, from `config-ready`)
   and the first render (`items-set` to `first-populated-paint`: 79, 295, 1267 and 6134 ms). At 50k the render of 480k DOM elements
   is 6.1 s of the 7.7 s.
2. The bodies take 262, 1019, 3370 and 14224 ms from first paint to `bodies-read` (before, the same work held the paint up for
   1259, 5686, 22541 and 56424 ms). `read_notes` is called 4, 17, 20 and 25 times. At 50k 8.3 s of the 14.2 s is long frames: the commits.
3. The Rust and WebView2 start (process start to page load, about 300 ms) and the script load (`main` at about 85 ms) did not
   change; `config-ready` is 11 ms after `main` (was 20 ms).
4. IPC at the end is 41 to 62 calls at every size (before: 1588 to 53038). Of those, `plugin:fs|exists` and `plugin:fs|read_text_file`
   are 9 each (task lists and others, not notes). A window-focus rescan ran in some 5k launches (up to 73 calls).

## Not measured or not certain

- What is painted when the window first appears, and the responsiveness while the bodies stream in: nothing was looked at or touched;
  both are read from the marks, the long frames and the window poll.
- The old exe was re-run today (control) at 1k and 5k only. It was slower than on the baseline day: first paint 3690 ms against 3456 at 1k, and
  11135 against 8149 at 5k (9.0, 11.0 and 10.8 s after the page load). The cause is unknown (the watcher process or the state of the machine). Both are given;
  the "after" numbers were taken on the same day and with the same watcher as the control. The window visible time of the old exe at 20k
  and 50k was not run (it does not depend on the vault: the window is created visible).
- The heap has two figures, `usedJSHeapSize` and `Runtime.getHeapUsage`, that were not checked against a heap snapshot. They differ
  about 2.5 times in the old build and 1.1 to 1.3 times in the new one, so the growth looks small by the first (50k: 432 to 637 MB)
  and large by the second (158 to 581 MB). The "before" heap after settling at 20k and 50k was read at first paint (the baseline did not wait). Values right after
  `bodies-read` are inflated by garbage not yet collected (5k: 154 MB then, 104 MB two seconds later).
- The baseline had no memory of the WebView2 processes; the old exe's working set exists for 1k and 5k only (control).
- `window-shown` is set when `show()` comes back to the page, which can be later than the window is visible: at 20k it is 67 ms later
  (the main thread is busy). Use the external window time for visibility.
- The poll finds a window of the right process that is visible and larger than 50 by 50 pixels. The old exe's window is first seen at
  1381 by 776 (the default size, before the saved maximised size is applied), the new one at 1550 by 926.
- A `scan_vault` time is not split into the walk, the frontmatter parse and the transfer of the metadata to the page.
- The update check ran once in every launch (in the IPC counts after settling).
