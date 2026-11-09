# Snapshot

A Chrome extension for capturing a webpage element or a rectangular area, copying it, and keeping the images you want in a local library. No accounts, uploads or analytics.

Requires Chrome 116 or newer. Current version: 0.6.0. See the [changelog](CHANGELOG.md).

**[Read the illustrated user guide](docs/index.html)** for capture, folders, settings and troubleshooting. Downloaded a copy of the repository? Open `docs/index.html` in your browser; the guide works offline.

## Install

Snapshot is not on the Chrome Web Store. Install it as an unpacked extension:

1. Download **`Snapshot-<version>.zip`** from the repository's [Releases](https://github.com/CoffeeRunsMyCode/snapshot-extension/releases) page. Do not use GitHub's "Source code" archive: it is the development source, not the installable package.
2. Extract it to a folder you will keep, for example `Documents/Snapshot`. Chrome loads the extension from this folder every time it starts, so don't delete or move it.
3. Open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the extracted folder (the one containing `manifest.json`).
5. Optional: pin Snapshot from Chrome's Extensions (puzzle-piece) menu.

### Update

1. Download the new release ZIP and extract it **over the same folder** Chrome already loads, replacing the old files.
2. On `chrome://extensions`, click the reload icon on the Snapshot card.
3. Refresh any open library tabs and webpages you want to capture.

Do not uninstall to update: uninstalling deletes your local library. Loading the new version from a different folder installs a separate copy of the extension with its own, empty library.

## Capture

1. On a regular webpage, click the Snapshot icon or press **Alt+Shift+S**.
2. **Element:** hover and click an element. With the keyboard, use Left/Right to move between elements, Up to select a parent and Down to return to the child you expanded from, and Enter to capture.
   **Area:** press and drag anywhere to draw a rectangle; releasing captures it. Or press **A**, enter X, Y, width and height, and choose **Capture** (or press Enter).
3. The image is copied to your clipboard when Chrome allows it. The initial confirmation offers **Save to library** and **Download PNG**. A thin bar shows its five-second auto-hide timer. Hovering or focusing the panel holds a fresh five seconds until you move away. Its × hides it immediately without exiting capture mode. Saved images remain available in the library for downloading later.

There is no toolbar over the page: a short hint shows the gestures when capture starts, then fades. Escape, or clicking the Snapshot icon again, exits capture mode. Padding is in the library's Settings. Only the visible part of the page is captured. Dismissing the notification leaves the clipboard and saved library images unchanged. Keep capturing on the same page; each successful capture replaces the clipboard image when automatic copy is enabled and succeeds.

## Library

Right-click the Snapshot icon and choose **Open library**, or press **Alt+Shift+L**.

- Rename an image by clicking its title (or press F2, or use Rename in the preview). Clear the name to go back to the page title. Names can’t use \ / : * ? " < > | or Windows-reserved names such as CON, because they may become file names.
- Download several at once: choose Select, pick images, then Download. You get one ZIP file.
- Search, filter by website, view Recently saved or Favorites, and switch between grid and list. Recently saved shows captures taken within the last seven days; older saved images remain in All snapshots and their folders. This filter does not delete images.
- Copy, download, open the source page, or delete images.
- **Folders:** create them from the sidebar and move images individually or in a batch. Each image is in at most one folder. Deleting a folder keeps its images in Unfiled.
- **Recently deleted:** deleted images stay here until you restore them or choose **Empty trash**. Nothing expires automatically.

## Settings

Open **Settings** in the library sidebar.

| Setting | Default | Effect |
| --- | --- | --- |
| Copy to clipboard | On | Turn off to avoid clipboard writes. You can still save, download, or copy from the library. |
| Save to library | Off | Turn on to save each capture automatically. If saving fails, retry with Save to library. |
| Padding | None | Adds 8, 16 or 24 pixels around every capture. |
| Keep page title and link | On | Turn off to save new images with the title "Snapshot" and no source link. Existing images are unchanged. |
| Theme | Match system | Light, Dark, or follow your system setting. |
| Ask where to save downloads | Off | Off: downloads go where Chrome normally saves files. On: Chrome asks for a folder each time. |

Settings stay on this device.

## Privacy

Everything stays on your device in the extension's local storage. New saves drop URL credentials, query strings and fragments. Local-file paths are never saved. Downloads use neutral timestamp filenames, unless you renamed the snapshot, in which case your name is used. Page titles and links never appear in filenames. The developer collects nothing and can’t see your captures. You are responsible for what you capture, name and share; see [PRIVACY.md](PRIVACY.md).

Sharing a capture shares everything visible inside your selection. Saved source information is not attached to copies or downloads. Sanitized links may still contain private information in their path.

Clipboard contents and downloaded files are separate copies. Deleting from the library or uninstalling does not remove them. The library is not encrypted. See [PRIVACY.md](PRIVACY.md) for details and [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| The icon shows **!** and capture won't start | Chrome blocks extensions on `chrome://` pages, the Chrome Web Store and some built-in pages. Open a regular website. If the page was open before you installed or updated Snapshot, reload it. |
| Capture doesn't work on local files | On `chrome://extensions`, open Snapshot's **Details** and turn on **Allow access to file URLs**. |
| "Could not copy" | Some pages or system settings block clipboard access. Use **Save to library** or **Download PNG** instead. |
| A keyboard shortcut does nothing | Another extension or app may use it. Check or change it at `chrome://extensions/shortcuts`. |
| "The extension was updated. Reload this webpage" | Reload the page after updating or reloading the extension. |
| "Close other Snapshot library tabs…" | A library upgrade is waiting. Close every library tab, then open the library again. |
| My library is empty after updating | Chrome may be loading a different folder. Make sure you updated the folder you originally loaded, and don't uninstall. |
| "Capture is too large" | Select a smaller area. |

## Development

```sh
npm ci
npx playwright install chromium
npm run build          # compile src/ to dist/
npm test               # unit tests
npm run test:browser   # Playwright tests with synthetic data and isolated browser profiles
```

Source is in `src/`. The compiled `dist/` is committed so the repository can be loaded unpacked directly. Rebuild and commit `dist/` together with source changes. Browser tests never use your personal Chrome profile.

## License

[MIT](LICENSE)
