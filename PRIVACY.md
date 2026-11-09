# Snapshot privacy policy

Snapshot is free, open-source software (MIT license). The developer collects nothing, receives nothing and cannot see anything you capture.

## What Snapshot does with your data

Nothing leaves your device. Snapshot has no accounts, servers, analytics, telemetry, advertising or network requests of its own. The developer has no access to your images, names, settings or browsing.

## What is stored, and where

- **Settings** are kept in the extension's local storage in your Chrome profile. They are not synced.
- **Temporary drafts**: a fresh capture is held in memory and Chrome's session storage until you save, download or discard it, or the tab navigates, closes or the browser restarts.
- **Library** (only if you choose Save to library, or turn on automatic saving): the PNG, the page title and link (unless you turn off "Keep page title and link"), a selection label, size, date, any name you give it, favorites and folders. This is stored in the extension's local database (IndexedDB) in your Chrome profile. It is not synced, not encrypted, and is deleted when you uninstall Snapshot.
- **Copies you make**: by default a capture is copied to the clipboard (you can turn this off in Settings). Clipboard contents are managed by your operating system and may be readable by other apps or synced by your system.
- **Downloads** are ordinary PNG files saved by Chrome. Deleting from the library or uninstalling never removes them, because Chrome does not let extensions run code on uninstall. Filenames are neutral timestamps; if you rename a snapshot, your name is used.

## Protections built in

Links saved with a capture have credentials, query strings and fragments removed, and local-file paths are not kept. Page titles and link paths can still contain private details, so you can turn source information off entirely. Snapshot asks for the minimum browser permissions and only reads a page after you start a capture.

## What you control

You choose what to capture, whether to copy or save it, what to name it, and whether and where to download or share it. You can delete images (they go to Recently deleted first), empty the trash, and uninstall at any time.

## Your responsibility

A screenshot shows everything inside your selection, which may include personal, confidential or copyrighted material. You are responsible for what you capture, name, store, share or download, for the files and clipboard copies you create, and for complying with the law and the terms of the sites you capture. The developer does not see, review or control any of it, and is not responsible for it. Snapshot is provided as is, without warranty, as set out in the [MIT license](LICENSE).

The library is not an encrypted vault. Anyone with access to your device or browser profile may be able to see it.

## Children and sensitive data

Snapshot is a general-purpose tool and is not directed at children. It does not knowingly collect any personal data from anyone. Avoid capturing sensitive information (passwords, health, financial or government records) unless you are comfortable with it being copied or stored on your device.

## Changes

If this policy changes, the updated version will be published in this repository and the date or version noted in the changelog. Continued use after a change means you accept it.

## Contact

Open an issue on this project's GitHub page. Please do not include screenshots, tokens or private links. For security problems, see [SECURITY.md](SECURITY.md).

This document is a plain-language description of how the software behaves and is not legal advice.
