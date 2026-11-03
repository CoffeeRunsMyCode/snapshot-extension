# Snapshot privacy guide

Snapshot processes captures locally. It has no accounts, analytics, advertising, uploads or remote application services.

## Capture and copy

The visible viewport is captured in memory and cropped to your selection. The crop is held in isolated content-script memory and trusted extension session storage. It is never attached to the webpage as an image, canvas or image URL. The in-page popup shows status and buttons without screenshot pixels. Scripts on the webpage cannot access isolated extension variables. Synthetic clicks and keyboard events are rejected.

Capturing attempts to copy the image automatically by default. Turn off Automatically copy captures in library Settings to avoid clipboard writes during capture. Saved images can be copied from the library. Clipboard contents can be read by applications or websites with the necessary permissions and may be synced by your operating system. Do not capture sensitive content if you do not want it copied.

Each tab retains its latest temporary draft internally. A successful new capture replaces it. Hiding the notification or exiting capture mode does not clear it, and there is no Last capture control to reopen its actions. Navigating/reloading, closing the tab or restarting the browser/extension clears the draft. Session copies survive service-worker suspension. Storage limits may require capturing a smaller area. Dismissing the notification does not change the clipboard or images already saved to the library.

## What is saved

Settings are stored locally, with no sync. Turn off Save source information to omit source titles and URLs from new captures and saves; they use the neutral title Snapshot. Existing entries are not modified. Turning this off before saving also removes source metadata from that new save.

Choosing Save to library, or enabling automatic saving, stores the PNG, page title, sanitized source URL, generic selection label, timestamp, dimensions and clipping status in local IndexedDB. Favorites, folder names and assignments are local too. URL credentials, query strings and fragments are removed before retaining a new draft. Local-file URLs are omitted. Some links may lose their route or stop opening the exact resource. Existing saved URLs from earlier versions are not rewritten.

This prevents typical query-string or fragment access tokens from being retained. It cannot identify every secret: a URL path, title or image can itself contain private data.

## When local information can become exposed

Local storage alone does not transmit a URL or screenshot to anyone. Exposure can occur when you share a screenshot or source link, share your device/browser profile, sync clipboard contents, copy profile backups elsewhere, or run software with access to your profile. A malicious webpage cannot read the screenshot through Snapshot's popup, but can still change its own visible content or read clipboard data if you separately grant it permission.

## Deletion and permissions

Deleting snapshots moves them to Recently deleted, stored locally until you restore them or confirm Empty trash. Trash does not expire automatically. Deleting a folder keeps images in Unfiled. Uninstalling removes the local library. Downloads and clipboard contents are separate copies, unaffected by deletion or uninstall. Download filenames use neutral timestamps.

Local storage is not an encrypted vault. Clearing ordinary browsing history does not clear extension storage. Snapshot provides no cloud backup or synchronization.

Permissions: activeTab and scripting enable capture after invocation; downloads saves PNGs; clipboardWrite supports copying; contextMenus adds Open library; storage retains temporary drafts in session memory. File access is optional through Chrome settings.

Automatic saving is off by default. If enabled, each capture is saved to the local library, including its pixels and source metadata according to your source-information setting.
