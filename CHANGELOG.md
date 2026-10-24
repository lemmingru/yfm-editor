# Changelog

## [0.4.0] - 2026-10-24

### Added

- Document outline sidebar with heading navigation in WYSIWYG and Markdown modes,
  active-section highlighting, and collapsible subsections.
- Toolbar toggle and localized **View → Document Outline** menu command
  (⌥⌘O on macOS). Outline visibility is remembered for each saved file; narrow
  windows use an overlay that closes after navigation.
- Regression coverage for outline navigation, per-document view state, Markdown
  round-trips, and unavailable images.

### Fixed

- Opening a document with unavailable or protected images no longer marks it as
  edited. Failed image loads preserve the original image nodes, dimensions,
  titles, and links instead of replacing them with plain Markdown text.

### Changed

- Updated editor, Diplodoc, Tauri, build, and test dependencies and lockfiles.
- Source builds now require Node.js 24 LTS (or 26+), npm 11.5.1+, and Rust 1.90+;
  `.nvmrc` selects Node.js 24.
- Kept the previous browser build targets for compatibility with the system
  WebView after the Vite upgrade.
