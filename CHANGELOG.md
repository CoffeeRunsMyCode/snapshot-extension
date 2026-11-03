# Changelog

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
