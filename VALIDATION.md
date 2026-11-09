# Validation — Snapshot 1.0.0

Latest typecheck, build, test and dependency-audit results: 9 November 2026, run on the release commit before tagging `v0.6.0`.

## Automated checks

**1.0.0 release candidate, full page removed (9 November, branch `next-0.7`):** after the owner's real-Chrome test failed on full-page capture ("The page changed while scrolling"), the owner chose to drop it. Removed the feature, its icon menu item, F key, tests and documentation. Typecheck pass; build pass; unit 26 of 26; browser 34 of 34.

**Capture overlay design pass and guide dark mode (9 November, branch `next-0.7`):** test changes: the notification now sits 24px from the edges (spacing scale), and the installed-extension ZIP wait was raised from 4 to 15 seconds after one slow run under load (the ZIP itself was valid). Screenshots reviewed by the assistant: capture overlay (hint, coordinates panel, notification) in light and dark at 1200px and 375px; user guide in dark mode at 1200px and 375px. A UI review subagent found no blockers; applied: 44px touch targets and an outline contrast ring. Guide images regenerated. **Not yet tried in real Chrome.**

**Dark mode and guide link (9 November, branch `next-0.7`):** typecheck pass; unit 22 of 22; browser 32 of 32, including the installed extension saving Theme = Dark, reapplying it after reload and using the dark surface colour, and the Quick guide's link to the bundled full guide. Screenshots reviewed by the assistant: library (system dark and forced dark on a light system), Settings, help popup and capture overlay. The full user guide page itself stays light. Not yet tried in real Chrome.

**Renaming (9 November, branch `next-0.7`):** typecheck pass; unit 22 of 22; browser 33 of 33 with a new rename test covering card rename with whitespace tidying, focus return, search by new name and by page title, Esc cancel, preview Rename, clearing back to the page title, and F2. Card and preview rename fields reviewed in screenshots. Not yet tried in real Chrome.

**Name rules, named downloads, ZIP (9 November, branch `next-0.7`):** typecheck pass; unit 26 of 26, including name rules (forbidden characters, trailing full stop, Windows reserved names), download names never using page titles, ZIP duplicate numbering, and ZIP structure (UTF-8 names, CRC checked against Node zlib, bytes stored unchanged); browser 34 of 34, including the rename error staying open on Enter and cancelling on blur, and the installed extension requesting `Snapshot/<name>.png` for a renamed snapshot and producing a valid ZIP from Select → Download. Fixed a timing race in the installed-extension test (Settings read before the dialog had loaded); it then passed 4 runs in a row. The test browser saves every file as `download.png`, so names are checked from what Snapshot requests, not from disk. Not yet tried in real Chrome.

**Design pass (9 November, `design-pass` branch):** typecheck pass; unit tests 22 of 22 pass; browser tests 32 of 32 pass (source-link test updated: cards now show the site name, with the full address as the link's title). Screenshots reviewed by the assistant at 1200px, 390px, 375px and 320px: library grid, list, selection, empty library, Quick guide and Settings. A UI review subagent found no blockers; star visibility, touch target size and the source link's spoken label were fixed afterwards. Guide images regenerated. Not yet tried in real Chrome.

**Alignment fixes (9 November):** unit 22 of 22 and browser 32 of 32 pass. A Playwright measurement confirmed matching edges: sidebar toggle icon and content (252px), search and grid right edge (1168px), card Copy and Delete icons with the image edges, folder + with folder counts, preview title and close icon (24px each). Dropdowns in Settings and Move reviewed in screenshots.

| Check | Result |
| --- | --- |
| TypeScript typecheck (`npm run typecheck`) | Pass, 9 November |
| TypeScript build (`npm run build`) | Pass, 9 November. Rebuilt `dist/` for 0.6.0: the in-page capture toolbar is removed (click captures an element, drag captures an area, A opens area coordinates, start hint fades, padding moved to Settings). |
| Release check, 9 November | Typecheck pass; build leaves `dist/` unchanged; unit 22 of 22 and browser 32 of 32 pass |
| Unit tests (`npm test`) | 22 of 22 pass, 9 November, including reuse of an open library tab and the Ask where to save download setting |
| Browser tests (`npm run test:browser`) | 32 of 32 pass, 9 November, including countdown synchronization, hover/focus reset, reduced motion, five-second hiding, continued capture, desktop/narrow action reachability, no toolbar controls on the page, start hint that fades and never takes clicks, drag-to-area without an extra element capture, a small click wobble still capturing the element, area drags released over the notification, keyboard coordinates panel (Enter captures, Escape and Cancel close it), padding from Settings, the installed extension's padding setting persisting, and the installed extension reusing an open library tab (with and without a specific capture) |
| Visual check (assistant) | 9 November: screenshots of the start hint, coordinates panel and notification reviewed at 1200px and 390px; regenerated user guide screenshots reviewed. Not yet tried in real Chrome. |
| Dependency audit (`npm audit`) | 9 November, 0 known vulnerabilities (point-in-time) |

**Unit tests** cover:
- capture and toolbar message routing, and rejection of requests from the wrong tab, document, frame or page
- crop geometry and neutral download filenames
- source URL sanitization and safe link schemes
- folder name rules and library filtering

**Browser tests** run in Chromium with synthetic data and generated, isolated profiles. They cover:
- **Capture:** the overlay is excluded from the image; panel persistence and reopening; copy failure recovery; narrow layouts; keyboard and coordinate capture; auto-copy off; page scripts cannot read pixels or trigger actions.
- **Installed extension (one test):** loads the real extension and verifies isolated drafts, sanitized saved URLs, clipboard writes, PNG download, settings, automatic save and retry after a storage failure.
- **Library (13 tests):** source links, folders, single and bulk moves, folder deletion, Undo, upgrades from older databases (version 1 and later), duplicate-name and stale-write protection, rollback after failed writes, selection, sidebar and layout persistence, and Recently deleted.

The installed-extension test grants broad host access in its generated test copy so automation can inject the capture script. The production manifest uses `activeTab` only.

## Owner acceptance for 1.0.0 (user-reported, 9 November 2026)

The owner tested `next-0.7` in real Chrome and wrote "accepted". Reported individually:

- Removal of full-page capture: OK.
- Dark mode: tested.
- Batch download (Select → Download, ZIP): works as intended.
- Rename: one bug. After renaming, a thin green line stayed beside the title until the owner clicked elsewhere. Cause: focus returned to the title and the card clipped its focus ring to a sliver. Fixed after acceptance: a rename started with the mouse no longer leaves a focus ring; one started from the keyboard returns focus with a complete ring. Browser test updated for both paths; unit 26 of 26, browser 34 of 34. **The owner has not re-tested this fix.**

Not reported individually (covered only by the overall "accepted"): update in place over the 0.6.0 library, element and area capture with paste, Save and Download from the notification, the `chrome://` help popup. No Chrome version was given.

## User review of 0.6.0 (user-reported, 9 November 2026)

The user said they like the new library design and asked to prepare the release. The release-ZIP acceptance list below was completed for 0.5.2 and has not been repeated for 0.6.0.

## Manual acceptance (user-reported completion, 2 November 2026)

The user confirmed completion of the release-ZIP acceptance-testing group on 2 November. The checks below are recorded on that basis; they were not independently repeated by the assistant. Chrome version and tested ZIP checksum have not been supplied. A rebuilt release ZIP still needs matching verification; the latest UI polish re-check remains separate.

Acceptance scope: a real Chrome installation loaded from the release ZIP, in a separate profile with synthetic content:

- [x] Toolbar click and Alt+Shift+S start capture with production `activeTab` permissions.
- [x] Element and area capture. Paste the copied image into another application.
- [x] Open an actual downloaded PNG.
- [x] Settings persist. Auto-copy off and source info off behave as described.
- [x] Library: search, source links, favorites, folders, moves, delete, Undo, Recently deleted, persistence after restart.
- [x] Browser-internal pages show capture help. File access works only after it is enabled.
- [x] Update in place from an older version keeps images, metadata, favorites and folders. Exercise blocked-upgrade recovery with a second library tab open.

## Known limitations

- Only what is visible on screen is captured. Very large selections may exceed temporary storage.
- Large-library performance has not been measured.
- On older Chrome versions, the help popup may need a second toolbar click.

## Reproduce

Run `npm ci`, `npx playwright install chromium`, `npm run build`, `npm test` and `npm run test:browser`. `SNAPSHOT_PLAYWRIGHT_PATH` and `SNAPSHOT_CHROMIUM_PATH` can point to existing installations. `SNAPSHOT_SCREENSHOT_DIR` saves visual QA screenshots.
