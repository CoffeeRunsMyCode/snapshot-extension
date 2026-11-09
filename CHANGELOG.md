# Changelog

## 1.0.0 (9 November 2026)

- Capture controls match the library: the same spacing, buttons and surfaces, a neutral notification border, and the countdown as a line along the bottom edge. The coordinates panel follows dark mode. Buttons are larger on touch screens, and the selection outline has a thin contrasting ring so it shows on any page.
- The user guide follows your system's dark setting.
- After renaming a snapshot with the mouse, no focus ring is left beside its title. Keyboard renames still return focus to the title, now with a complete ring.
- Dark mode. New **Theme** setting: Match system (default), Light or Dark. Covers the library, the capture controls on webpages and the "Can't capture this page" popup. A saved Light or Dark choice applies before the page appears, so there's no flash.
- Rename snapshots: click a title, press F2 on a preview, or use Rename in the preview. Enter saves, Esc cancels, and an empty name goes back to the page title. The page title is kept, shown in the preview, and still searchable. Names that Windows can’t use as file names (\ / : * ? " < > |, or reserved names such as CON) show an error under the field and aren’t saved.
- A renamed snapshot downloads under its name. Others keep the neutral timestamp. Page titles never appear in file names.
- Select mode has a **Download** button: one image downloads as a PNG, several as one ZIP (duplicate names get “(2)”, “(3)”). With “Ask where to save downloads” on, you’re asked once.
- Privacy policy and security policy rewritten in plain language: nothing leaves your device, the developer can’t see your captures, and you’re responsible for what you capture, name and share.
- The Quick guide links to the full user guide, which ships inside the extension and works offline.
- The guides now say plainly that deleting from the library, or uninstalling, never removes PNG files you downloaded.

## 0.6.0 (9 November 2026)

### Capture

- The capture toolbar is gone, so nothing covers the page while you select. Click captures an element and dragging captures an area. A short hint shows the gestures when capture starts, then fades.
- Press **A** to type exact area coordinates. Escape, or clicking the Snapshot icon again, exits capture mode.
- Capture padding moves to the library's Settings.
- On narrow windows the notification stays at the bottom, and moves to the top while the coordinates panel is open.
- The toolbar tooltip now says you can capture an element or an area.
- New setting, **Ask where to save downloads** (off by default). Off, downloads go wherever Chrome normally saves files; on, Chrome asks each time and remembers the last folder.

### Library

- Opening the library (icon menu, shortcut or a capture notification) switches to the library tab that's already open instead of opening another one.
- Library design pass: plainer, calmer layout on one spacing scale. Snapshots are no longer boxed cards: the image, its title and one line (site · date · folder) with quiet actions underneath.
- Removed the "Stored on this device" label, the repeated counts in the header and footer, the letter badges next to websites, and the eyebrow in the preview.
- Settings are grouped into **When you capture** and **Saving**, with one short line of help each. Two settings were renamed: **Copy to clipboard** and **Keep page title and link**. **Save settings** is now **Save**.
- Shorter Quick guide and empty-library text. The sort and view controls hide while the library is empty.
- Larger buttons on touch screens.
- Dropdowns have even spacing on both sides of the text and arrow. Icon buttons line up with the content edges around them.

## 0.5.3

- The capture toolbar no longer runs away from the pointer. It moves only after the selection settles, holds still and fades while the pointer is near it, and doesn't bounce straight back. Arrow-key selection still moves it at once.
- An area drag released over the toolbar now finishes the capture instead of leaving the drag stuck.

## 0.5.2

- A thin muted countdown bar indicates the notification's five-second auto-hide. Hover/focus restores a full five seconds; reduced-motion mode keeps the indicator static. Errors have no countdown.

- Hide initial capture confirmations after five idle seconds, pausing during hover or keyboard use. The × dismisses the notification without exiting capture mode. Last capture has been removed; clipboard images and saved library images are unaffected by dismissal. Errors stay available until dismissed.

- Keep the capture popup stationary while visible, so Save and Download stay reachable when the pointer crosses sticky page elements.

- Settings dialog in the library: automatic copy (on by default), automatic save (off by default) and saving source information (on by default).
- Keyboard element selection (Left/Right, Up/Down, Enter) and numeric coordinates for area capture.
- Deleted images go to **Recently deleted**, where you can restore them or empty the trash after confirming. The library database upgrades in place to version 3.
- Help popup with retry when a page can't be captured.
- Internal: the library page code is split into smaller modules, with no behavior change.

## 0.5.1

- Restored the in-page capture panel and automatic copy.
- Screenshot pixels are never placed in the webpage's DOM. Synthetic clicks and key presses from the page are rejected.

## 0.5.0

- Security release: draft actions are bound to the original tab, document and frame.
- New saves strip URL credentials, query strings and fragments. Local-file URLs are omitted.
- Downloads use neutral timestamp filenames.
- Added the privacy guide, security policy and dependency lockfile.

## 0.4.x

- Folders: create, rename and delete them, and move images individually or in batches. Deleting a folder keeps its images.
- Library card layout fixes for narrow screens.

## 0.3.x

- Initial release: element and area capture, automatic copy, library with search, website filter, favorites and batch delete with Undo.
