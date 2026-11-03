# Security

Report a vulnerability through the hosting platform's private vulnerability reporting feature if enabled. Do not post screenshots, tokens or personal source URLs in public issues. If private reporting is unavailable, open a minimal issue requesting a private contact channel without exploit details or sensitive data. Maintainers should enable private reporting before distribution.

Webpages are untrusted. Screenshot pixels stay in isolated content-script variables and trusted extension session storage; they are not exposed through page DOM. The popup's controls reject synthetic input. Save/download/discard messages require the stored draft ID, original tab, original document and top-level frame; caller-supplied pixels and metadata are ignored. Session storage is inaccessible to content scripts. Library download/delete requests require the library page.

The extension does not protect against a compromised browser, operating system, another privileged extension, physical profile access, or a user voluntarily copying/downloading sensitive content. A page can change its own appearance; always review the captured image before using it.

Run the build, unit tests and browser suite before release. The installed-extension automated fixture adds broad host permission only in a generated test copy to automate injection. The production manifest uses activeTab, so toolbar activation and permission behavior still need manual Chrome acceptance.
