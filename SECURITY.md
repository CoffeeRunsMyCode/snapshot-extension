# Security policy

Snapshot is a free, open-source hobby project maintained by one person, provided as is under the MIT license.

## Supported versions

Only the latest release receives fixes. Please update before reporting.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: open the repository's Security tab and choose "Report a vulnerability". Please do not post exploit details, screenshots, tokens or personal links in public issues. If private reporting is not available, open a minimal public issue asking for a private channel, with no technical details.

Helpful reports include the Snapshot and Chrome versions, steps to reproduce, and the impact you expect.

## Scope

In scope:

- A webpage reading, altering or triggering Snapshot captures, drafts or library data.
- Snapshot sending data off the device, or storing page information it should have removed (for example URL credentials, query strings or fragments).
- Bypassing the capture overlay's message and sender checks.
- Code injection or unsafe handling of page-supplied text in Snapshot's own pages.

Out of scope:

- A compromised browser, operating system or another privileged extension; physical access to a device or profile.
- Content you choose to capture, name, copy, download or share, and what other apps do with the clipboard or downloaded files.
- The library not being encrypted (this is documented).
- A page changing its own appearance, or sites that block capture.
- Findings that need a modified or side-loaded copy of the extension.
- Automated scanner output without a demonstrated impact.

## What to expect

Reports are handled on a best-effort basis by a volunteer. There are no guaranteed response or fix times. Valid reports will be fixed when practical and credited if you wish. There is no bug bounty.

## Design notes

Webpages are treated as untrusted. Screenshot pixels are not added to the page; messages are checked against the extension, tab, document and frame; the production manifest uses `activeTab` with no host permissions; and Snapshot makes no network requests. See [PRIVACY.md](PRIVACY.md).
