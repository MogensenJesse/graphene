# Startup baseline (WP0)

Status: measured 2026-11-22 on a release build, before any WP5 change. This is the number every WP5 step is compared against
([01-audit-fixes.md](01-audit-fixes.md), section 3 and WP0). Times are milliseconds since the page began to load (`performance.timeOrigin`) unless
a row says otherwise. Each cell is the median of 3 launches, with the minimum and maximum in brackets.

## What was built

- Tree: HEAD `b511468` plus 89 uncommitted paths (wave 1 of the audit fixes, not committed), including `src/lib/scrollbars.ts` (the
  JS-drawn scrollbar thumb, started from `main.tsx` before the first render, so its cost sits in the `main` to `config-ready` step),
  the Switzer Regular and SemiBold files and the token SCSS. Nothing of WP5 or WP6.
- Release profile: none set in `src-tauri/Cargo.toml` (Cargo defaults: `opt-level` 3, no LTO, 16 codegen units). `graphene.exe` is
  15.2 MB; `src-tauri/target/release` is 3.6 GB (the whole `target` folder is 25.5 GB, 21.9 GB of it debug).
- Frontend chunk: one JS file of 738 KB (226 KB gzip) and one CSS file of 89 KB.

## Machine

Intel Core Ultra 7 258V (8 logical cores), 31.5 GB RAM, Windows 11 Pro 10.0.26300, WebView2 runtime 157.0.4341.60, NVMe SSD
(SN5000S 1 TB), Node 24.22.2, cargo 1.95.0. The window was maximised (the user's saved window state, acrylic, created visible). The vaults had just
been written, so the OS file cache is warm; the machine was otherwise idle. The release build checks for updates about 5 s after
launch (one request); it was left on.

## Method (repeat after each WP5 step)

1. Vaults: `node scripts/gen-synthetic-vault.mjs --out C:\gv\<size> --preset 1k|5k|20k|50k`, outside the repo (each also has 3 big notes of
   1 to 5 MB, 500 trashed notes and 2000 tasks). 1k is 17 MB, 5k 38 MB, 20k 116 MB, 50k 272 MB of notes.
2. Build without the Tauri CLI bundler (it needs the updater signing key): `npm run build:mcp`, `npm run pack:mcpb`, `npm run build`,
   then in `src-tauri`: `cargo build --release --features tauri/custom-protocol` (that feature embeds `dist/`; the page URL is then
   `http://tauri.localhost/`, not `localhost:1420`). The exe is `src-tauri/target/release/graphene.exe`.
3. Back up and hash `%APPDATA%\com.graphene.app`. For each launch write `graphene\config.json` with the one vault, in the shape of
   `src/lib/vaultList.ts`: `{ "active": p, "vaultPath": p, "vaults": [{ "path": p, "name": n, "shared": true }] }`. Start the exe with
   `WEBVIEW2_USER_DATA_FOLDER=C:\gv\wv2profile` (a temp profile, so the real one is untouched) and
   `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222 --disable-features=CalculateNativeWinOcclusion
   --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"` (the last three keep a covered window painting, or
   `first-populated-paint` never fires). The release exe has no inspector, but this port works.
4. One throw-away launch first: over the Chrome DevTools Protocol (Node 24 has a global `WebSocket`; targets at
   `http://127.0.0.1:9222/json`) run `localStorage.setItem("graphene.perf","1")` and `Page.reload`, then stop it. The flag is read at page
   start, so every measured launch is a fresh process whose first load is measured. A reload is not the same: at 1k the reload read
   2141 ms to `first-populated-paint` against 3048 to 3168 ms on a fresh launch.
5. Per measured launch: wait for the mark `first-populated-paint` (up to 180 s), then read `performance.getEntriesByType("mark")`,
   `performance.timeOrigin`, `performance.memory.usedJSHeapSize`, `Runtime.getHeapUsage` and `perfReport()` (its `console.table`
   calls are captured by swapping `console.table` for the call, which is lossless); wait until 9 s after page load and read them
   again (so the 5 s updater check is in). The Rust and WebView2 start is `timeOrigin` minus the process creation time
   (`(Get-Process -Id <pid>).StartTime`). Stop only the PID that was started, 3 launches per vault.
6. Restore the AppData files, compare the SHA-256 list, delete `C:\gv\*`.

The driver (about 250 lines of Node, kept outside the repo) does steps 3 to 5.

## Results

At a glance (median, ms):

| | 1k | 5k | 20k | 50k |
|---|---|---|---|---|
| process start to page load | 314 | 300 | 300 | 308 |
| scan step (config-ready to scan-done) | 1698 | 1808 | 3533 | 8251 |
| bodies step (scan-done to bodies-read) | 1259 | 5686 | 22541 | 56424 |
| render step (items-set to first-populated-paint) | 51 | 241 | 1229 | 5898 |
| process start to first-populated-paint | 3456 | 8149 | 27717 | 71127 |

The details per vault size follow. A step is the time between a mark and the one before it.

### 1k (1000 notes, 3 launches)

| Mark | ms since page load: median (min to max) | step from the previous mark: median (min to max) |
|---|---|---|
| process start to page load (Rust + WebView2, not a mark) | 314 (296 to 330) | |
| main | 83.9 (80.7 to 89) |  |
| config-ready | 107.5 (100.8 to 108.7) | 20.1 (19.7 to 23.6) |
| scan-done | 1805.2 (1763.1 to 1854.3) | 1697.7 (1662.3 to 1745.6) |
| bodies-read | 3073.8 (2996.1 to 3112.9) | 1258.6 (1233 to 1268.6) |
| items-set | 3075 (2997.2 to 3114.3) | 1.2 (1.1 to 1.4) |
| first-populated-paint | 3126.4 (3047.9 to 3168.2) | 51.4 (50.7 to 53.9) |
| main to first-populated-paint | 3042.5 (2967.2 to 3079.2) | |
| process start to first-populated-paint | 3456 (3344 to 3483) | |

Heap, usedJSHeapSize at first paint: 25.2 (25.2 to 25.3) MB; Runtime.getHeapUsage used size at first paint 6.7 (6.7 to 6.7) MB; at about 9 s 12.5 (12.5 to 12.5) MB; DOM elements at first paint 9823 (9823 to 9823); first-contentful-paint 156 (136 to 160) ms.

| Long frames (over 50 ms) | count | total ms | longest ms | blocking ms |
|---|---|---|---|---|
| up to first paint | 1 (0 to 1) | 50 (0 to 54) | 50 (0 to 54) | 0 (0 to 0) |
| first paint to 9 s after page load (no window at 20k and 50k) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |

| IPC command | at first paint (median, min to max) | at about 9 s |
|---|---|---|
| `plugin:fs\|read_text_file` | 1511 (1511 to 1511) | 1511 (1511 to 1511) |
| `plugin:fs\|read_dir` | 52 (52 to 52) | 52 (52 to 52) |
| `plugin:fs\|exists` | 11 (11 to 11) | 11 (11 to 11) |
| `plugin:event\|listen` | 10 (10 to 10) | 10 (10 to 10) |
| `plugin:window\|set_theme` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:app\|version` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:window\|is_maximized` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:updater\|check` | 0 (0 to 0) | 1 (1 to 1) |
| total | 1587 (1587 to 1587) | 1588 (1588 to 1588) |

Each launch, first-populated-paint ms since page load: 3126, 3048, 3168

### 5k (5000 notes, 3 launches)

| Mark | ms since page load: median (min to max) | step from the previous mark: median (min to max) |
|---|---|---|
| process start to page load (Rust + WebView2, not a mark) | 300 (297 to 304) | |
| main | 82.8 (78.3 to 83.8) |  |
| config-ready | 103.4 (99.1 to 105.8) | 20.8 (20.6 to 22) |
| scan-done | 1911.7 (1902.8 to 1919.4) | 1808.3 (1803.7 to 1813.6) |
| bodies-read | 7598 (7591.5 to 7639.6) | 5686.3 (5672.1 to 5736.8) |
| items-set | 7601.1 (7594.5 to 7643) | 3.1 (3 to 3.4) |
| first-populated-paint | 7845.7 (7837.2 to 7884.3) | 241.3 (236.1 to 251.2) |
| main to first-populated-paint | 7761.9 (7754.4 to 7806) | |
| process start to first-populated-paint | 8149 (8137 to 8181) | |

Heap, usedJSHeapSize at first paint: 58.7 (57.9 to 58.9) MB; Runtime.getHeapUsage used size at first paint 19.4 (19.3 to 19.5) MB; at about 9 s 33.1 (33 to 33.2) MB; DOM elements at first paint 48273 (48273 to 48273); first-contentful-paint 148 (140 to 148) ms.

| Long frames (over 50 ms) | count | total ms | longest ms | blocking ms |
|---|---|---|---|---|
| up to first paint | 1 (1 to 2) | 243 (234 to 285) | 234 (228 to 243) | 133 (128 to 143) |
| first paint to 9 s after page load (no window at 20k and 50k) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |

| IPC command | at first paint (median, min to max) | at about 9 s |
|---|---|---|
| `plugin:fs\|read_text_file` | 5511 (5511 to 5511) | 5511 (5511 to 5511) |
| `plugin:fs\|read_dir` | 252 (252 to 252) | 252 (252 to 252) |
| `plugin:fs\|exists` | 11 (11 to 11) | 11 (11 to 11) |
| `plugin:event\|listen` | 10 (10 to 10) | 10 (10 to 10) |
| `plugin:window\|set_theme` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:app\|version` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:window\|is_maximized` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:updater\|check` | 1 (1 to 1) | 1 (1 to 1) |
| total | 5788 (5788 to 5788) | 5788 (5788 to 5788) |

Each launch, first-populated-paint ms since page load: 7846, 7884, 7837

### 20k (20000 notes, 3 launches)

| Mark | ms since page load: median (min to max) | step from the previous mark: median (min to max) |
|---|---|---|
| process start to page load (Rust + WebView2, not a mark) | 300 (296 to 306) | |
| main | 85.2 (84.2 to 85.9) |  |
| config-ready | 105.4 (103.3 to 106.4) | 20.2 (19.1 to 20.5) |
| scan-done | 3638.1 (3635.5 to 3647.3) | 3532.7 (3532.2 to 3540.9) |
| bodies-read | 26176.3 (26131.4 to 26209.9) | 22540.8 (22493.3 to 22562.6) |
| items-set | 26187.9 (26143.5 to 26221.5) | 11.6 (11.6 to 12.1) |
| first-populated-paint | 27418.3 (27417.2 to 27436.6) | 1229.3 (1215.1 to 1274.8) |
| main to first-populated-paint | 27333.1 (27333 to 27350.7) | |
| process start to first-populated-paint | 27717 (27714 to 27742) | |

Heap, usedJSHeapSize at first paint: 182.3 (182.3 to 182.3) MB; Runtime.getHeapUsage used size at first paint 65.6 (65.6 to 65.6) MB; at about 9 s 65.7 (65.6 to 65.7) MB; DOM elements at first paint 192257 (192257 to 192257); first-contentful-paint 148 (140 to 152) ms.

| Long frames (over 50 ms) | count | total ms | longest ms | blocking ms |
|---|---|---|---|---|
| up to first paint | 1 (1 to 2) | 1201 (1185 to 1305) | 1201 (1185 to 1246) | 1101 (1085 to 1146) |
| first paint to 9 s after page load (no window at 20k and 50k) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |

| IPC command | at first paint (median, min to max) | at about 9 s |
|---|---|---|
| `plugin:fs\|read_text_file` | 20511 (20511 to 20511) | 20511 (20511 to 20511) |
| `plugin:fs\|read_dir` | 1002 (1002 to 1002) | 1002 (1002 to 1002) |
| `plugin:fs\|exists` | 11 (11 to 11) | 11 (11 to 11) |
| `plugin:event\|listen` | 10 (10 to 10) | 10 (10 to 10) |
| `plugin:window\|set_theme` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:app\|version` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:window\|is_maximized` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:updater\|check` | 1 (1 to 1) | 1 (1 to 1) |
| total | 21538 (21538 to 21538) | 21538 (21538 to 21538) |

Each launch, first-populated-paint ms since page load: 27417, 27437, 27418

### 50k (50000 notes, 3 launches)

| Mark | ms since page load: median (min to max) | step from the previous mark: median (min to max) |
|---|---|---|
| process start to page load (Rust + WebView2, not a mark) | 308 (300 to 364) | |
| main | 84.7 (80.3 to 87.2) |  |
| config-ready | 107.2 (104.7 to 110) | 22.8 (20 to 26.9) |
| scan-done | 8360.9 (8179.6 to 8365.4) | 8250.9 (8074.9 to 8258.2) |
| bodies-read | 64789.3 (64571.4 to 64900.1) | 56423.9 (56391.8 to 56539.2) |
| items-set | 64818.4 (64607 to 64929) | 29.1 (28.9 to 35.6) |
| first-populated-paint | 70827 (70364.1 to 70838.3) | 5898 (5757.1 to 6019.9) |
| main to first-populated-paint | 70739.8 (70279.4 to 70758) | |
| process start to first-populated-paint | 71127 (70672 to 71202) | |

Heap, usedJSHeapSize at first paint: 431.5 (431.5 to 431.5) MB; Runtime.getHeapUsage used size at first paint 158.4 (158.4 to 158.4) MB; at about 9 s 158.5 (158.4 to 158.5) MB; DOM elements at first paint 480317 (480317 to 480317); first-contentful-paint 144 (140 to 160) ms.

| Long frames (over 50 ms) | count | total ms | longest ms | blocking ms |
|---|---|---|---|---|
| up to first paint | 2 (1 to 2) | 5901 (5677 to 5961) | 5840 (5622 to 5961) | 5740 (5522 to 5861) |
| first paint to 9 s after page load (no window at 20k and 50k) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |

| IPC command | at first paint (median, min to max) | at about 9 s |
|---|---|---|
| `plugin:fs\|read_text_file` | 50511 (50511 to 50511) | 50511 (50511 to 50511) |
| `plugin:fs\|read_dir` | 2502 (2502 to 2502) | 2502 (2502 to 2502) |
| `plugin:fs\|exists` | 11 (11 to 11) | 11 (11 to 11) |
| `plugin:event\|listen` | 10 (10 to 10) | 10 (10 to 10) |
| `plugin:window\|set_theme` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:app\|version` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:window\|is_maximized` | 1 (1 to 1) | 1 (1 to 1) |
| `plugin:updater\|check` | 1 (1 to 1) | 1 (1 to 1) |
| total | 53038 (53038 to 53038) | 53038 (53038 to 53038) |

Each launch, first-populated-paint ms since page load: 70838, 70827, 70364

## The biggest steps

1. Reading the bodies (scan-done to bodies-read): 40% of the time to first paint at 1k, 72% at 5k, 82% at 20k, 80% at 50k. It is
   linear, about 1.1 ms per note (880 to 890 reads a second at 5k and above, 16 in flight), and has no long frame: it is waiting on
   IPC, not parsing.
2. The scan (config-ready to scan-done): 1.7 s at 1k, 8.3 s at 50k. It holds the directory walk (52 to 2502 `read_dir` calls) and the
   500 trashed notes read one after the other; if all of those calls were serial, that is 2.4 to 3.1 ms per call.
3. The first render (items-set to first-populated-paint): 51 ms at 1k, 241 ms at 5k, 1.2 s at 20k, 5.9 s at 50k, one or two long frames that
   block the main thread for about that time, with 9.8k, 48k, 192k and 480k DOM elements.
4. A fixed 0.4 s before any vault work: about 300 ms from process start to the page (Rust and WebView2), 85 ms to `main` (the 738 KB
   script), 20 ms to `config-ready`.
5. JS heap at 50k: 432 MB (`usedJSHeapSize`; 158 MB by `Runtime.getHeapUsage`). The estimates in section 3 of the plan were 0.5 to 2 s
   at 5k and 5 to 20 s at 50k; measured, 7.8 s and 70.8 s to first paint.

## Not measured or not certain

- `observeIpc` in `src/lib/perf.ts` does work in WebView2 and in a release build. Tauri's IPC is a fetch to
  `http://ipc.localhost/<command>`. The resource timeline's own buffer holds only 250 entries (it was full), but the observer still sees
  every call: 5 extra `plugin:fs|exists` calls moved the count from 11 to 16 and the Network domain listed the same 5 requests, and
  `read_text_file` at 1k is 1511 = 1000 notes + 500 trashed + 11 config and task files.
- The two heap figures differ by about 2.7 times and neither was checked against a heap snapshot. `Runtime.getHeapUsage` is below the
  size of the note text on disk (158 MB against 272 MB at 50k), so it probably leaves out part of the heap. The renderer process's
  working set was not measured.
- First paint is `requestAnimationFrame` plus a timeout, as in `src/lib/perf.ts`; the moment the user sees the window (the window is created
  visible, so before the page) was not measured. `first-contentful-paint` is 140 to 160 ms at every size.
- Long frames after first paint: the 9 s window leaves no time after first paint at 20k and 50k, and shows none at 1k and 5k.
  The focus rescan, typing and the 1 to 5 MB read view are not part of this baseline.
- The update check (`plugin:updater|check`) runs once in every launch and is in the IPC counts.
