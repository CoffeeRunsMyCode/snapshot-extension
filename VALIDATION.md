# Validation — Snapshot 0.5.2

Latest build and test results: 3 November 2026. The standalone typecheck result is from 2 November; the dependency-audit result is from 31 October.

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript typecheck (`npm run typecheck`) | Pass, 2 November |
| TypeScript build (`npm run build`) | Pass, 3 November. Rebuilt `dist/` with the quiet notification countdown. |
| Unit tests (`npm test`) | 21 of 21 pass |
| Browser tests (`npm run test:browser`) | 28 of 28 pass, including countdown synchronization, hover/focus reset, reduced motion, five-second hiding, continued capture and desktop/narrow action reachability |
| Dependency audit (`npm audit`) | Last recorded: 31 October, 0 known vulnerabilities (point-in-time) |

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

- Only the visible viewport is captured. Very large selections may exceed temporary storage.
- Large-library performance has not been measured.
- On older Chrome versions, the help popup may need a second toolbar click.

## Reproduce

Run `npm ci`, `npx playwright install chromium`, `npm run build`, `npm test` and `npm run test:browser`. `SNAPSHOT_PLAYWRIGHT_PATH` and `SNAPSHOT_CHROMIUM_PATH` can point to existing installations. `SNAPSHOT_SCREENSHOT_DIR` saves visual QA screenshots.
