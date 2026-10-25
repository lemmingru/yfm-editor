# YFM Editor

**English** | [Русский](README.ru.md)

Version **0.5.0** · [Changelog](CHANGELOG.md)

A native macOS (and cross-platform) editor for Markdown files written in
[YFM](https://ydocs.tech) (Yandex Flavored Markdown), built on
[`@gravity-ui/markdown-editor`](https://github.com/gravity-ui/markdown-editor)
and packaged with [Tauri 2](https://v2.tauri.app).

Supports WYSIWYG + raw-markup + split-preview editing, with native handling of
YFM **multiline tables**, **cuts** (`{% cut %}`), **notes** (`{% note %}`), tabs,
files, LaTeX and Mermaid. Native spell checking and an English/Russian interface
are built in.

Document-based, like native macOS editors: each window holds one `.md` file, and
opening a file gives it a new window by default (switchable to reuse the current
window in Preferences). Files are opened from the native menu or by
double-clicking them in Finder (the app can be set as the default `.md` handler).
The UI renders in the system WebView (WKWebView on macOS); file reads/writes go
through the Rust core, so there is no HTTP server and no exposed filesystem API.

The repository is an npm workspaces monorepo: `packages/core` holds the shared,
platform-agnostic editor, and `packages/desktop` holds the Tauri application.

## Requirements

- Node.js 24 LTS and npm 11.5.1+ (`nvm use` selects the version in `.nvmrc`)
- Rust 1.90+ (`rustup`, stable) — for building the native app
- Xcode Command Line Tools (macOS)

## Install

```bash
git clone https://github.com/lemmingru/yfm-editor
cd yfm-editor
npm install
```

The first Tauri run/build downloads the Rust crates. If `npm run app` says
`Cargo was not found`, install Rust with `rustup`, restart the terminal, and
try again:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
cargo --version
```

On macOS, install Xcode Command Line Tools too:

```bash
xcode-select --install
```

## Develop

Runs the app in a native window with Vite HMR — edit React code and it hot-reloads:

```bash
npm run app      # = tauri dev
```

`npm run dev` still starts only the Vite server (browser, no file access) if you
just want to iterate on UI in isolation.

## Build

Produces a `.app` (and `.dmg`) bundle:

```bash
npm run app:build   # = tauri build
```

Output lands in `packages/desktop/src-tauri/target/release/bundle/`: the app in
`macos/YFM Editor.app` and an installer image in `dmg/`.

## Install a local build (unsigned app)

The build is signed ad-hoc, not with a Developer ID, and it is not notarized.
Gatekeeper therefore refuses to launch it as soon as the bundle carries the
`com.apple.quarantine` attribute — which macOS attaches to anything downloaded or
received from another machine, including the `.dmg`. The failure looks like
*"YFM Editor is damaged and can't be opened"* or *"cannot be opened because the
developer cannot be verified"*.

Copy the app to `/Applications` (or drag it out of the mounted `.dmg`) and then
clear the attribute:

```bash
xattr -dr com.apple.quarantine "/Applications/YFM Editor.app"
```

After that the app opens normally, including from Finder double-clicks and file
associations. A few notes:

- Only do this for a bundle you built or trust; the command disables the
  Gatekeeper check for that app.
- Running the `.app` straight from `target/release/bundle/macos/` usually needs no
  `xattr` at all, since a locally built bundle is not quarantined.
- Re-run the command after every new build you install — the attribute comes back
  with the freshly transferred bundle.
- Alternative for a one-off launch: right-click the app → **Open** → **Open**
  in the confirmation dialog (on recent macOS versions, System Settings →
  Privacy & Security → **Open Anyway**).
- Signing with a Developer ID (`APPLE_SIGNING_IDENTITY`) and notarizing removes
  the need for any of this.

To make the app the default Markdown handler: in Finder, right-click a `.md` file
→ Get Info → Open with → choose **YFM Editor** → Change All.

## Use

- **File ▸ New** (⌘N), **Open…** (⌘O), **Open Recent**, **Save** (⌘S),
  **Save As…** (⇧⌘S), **Revert to Saved** from the native menu.
- **View ▸ Toggle Theme** (⇧⌘L) and **Check Spelling** switch the theme and the
  native WebView spell checker.
- **Edit ▸ Copy Agent Context** (⌥⌘C) copies `path:line` (or `path:start-end`) plus
  the selected — or current block's — markdown in a fenced block, ready to paste
  into a coding agent. In WYSIWYG mode the selection cannot always be mapped back
  to the source; the app then asks you to switch to markup mode.
- **Preferences…** (⌘,) sets theme, interface language (English/Russian/system),
  the default editor mode, whether an opened document reuses the current window,
  and spell checking.
- Edit in **WYSIWYG** (default) or **markup**, or open the **split preview** using
  the editor toolbar.
- Images in WYSIWYG and split preview support HTTP(S) URLs and local files.
  Relative paths (`./assets/diagram.png`, `../diagram.svg`) resolve from the
  Markdown file's folder; save a new document first. Absolute paths and `file:`
  URLs also work. Unavailable images show a placeholder with the original source
  and a retry button, without changing the Markdown, image dimensions or saved
  state. Protected attachments still require server access; Tracker sign-in is
  not integrated yet.
- Use the sidebar button at the start of the toolbar, or **View → Document
  Outline** (⌥⌘O), to navigate by heading in either editable mode. The outline
  updates as you edit, highlights the current section, and lets you collapse
  subsections. It starts hidden and remembers its visibility for each saved file.
  In narrow windows it overlays the editor and closes after a jump.
- Unsaved changes show up as a `*` in the window title plus the macOS
  edited-document dot in the close button; the status bar shows the document's
  folder, or "Not saved to disk yet". You are warned before discarding unsaved
  changes and before overwriting a file that changed on disk.
- Double-clicking a `.md` file in Finder opens it; if the app is already running
  the open is near-instant (the process stays resident).

## Tests

The project uses two complementary test systems:

- [Vitest](https://vitest.dev) with jsdom and Testing Library tests the React
  workflow, persisted preferences and recent files, and the TypeScript-to-Tauri
  command contract. Tauri, native dialogs, and the editor component are mocked
  in these tests so they stay fast and do not open application windows.
  A second Vitest project in `packages/core` round-trips markdown through the
  WYSIWYG document model, guarding documents kept in version control against
  reformatting the author did not ask for.
- Rust's built-in test runner tests filesystem helpers, content hashing, native
  menu escaping, and cold-start/focused-window routing state.

Run the complete JavaScript/TypeScript test suite once:

```bash
npm test
```

Run frontend tests in watch mode while developing:

```bash
npm run test:watch -w @yfm-editor/desktop
```

Run the Rust tests from the repository root:

```bash
npm run test:rust
```

Run the static TypeScript checks as an additional regression check:

```bash
npm run typecheck
```

Before merging a change that affects files, windows, or the native lifecycle,
run all three checks:

```bash
npm test
npm run test:rust
npm run typecheck
```

The automated React suite covers cold-start file loading, Save As for a dirty
untitled document, and protection of dirty content after an external file
change. It does not launch the real macOS WebView or exercise Finder events and
native menus end to end. Changes to those integrations should additionally be
smoke-tested with `npm run app` by opening, editing, saving, externally changing,
and closing a document.

## How it works

- `packages/desktop/src-tauri/src/files.rs` owns file commands and external-change
  watchers; `menu.rs`, `windows.rs`, and `platform.rs` contain native menus,
  window/open routing, and platform-specific integration, with shared state in
  `state.rs`. `lib.rs` composes those modules into the Tauri application.
- `packages/desktop/src/api/client.ts` calls those commands through Tauri `invoke`
  and uses `@tauri-apps/plugin-dialog` for native open/save dialogs.
- `packages/desktop/src/App.tsx` is the per-window document shell: state,
  native-menu wiring, window title, and the unsaved-changes guard. `preferences.ts`
  and `recentFiles.ts` persist settings and the recent-files list; `i18n.ts` holds
  the English and Russian strings, including the native menu labels sent to Rust.
- The shared `@yfm-editor/core` package owns `EditorPane` and the YFM editor
  configuration used by the desktop application and future integrations.
  `markdownFormatting.ts` adjusts how the WYSIWYG mode writes markdown back out,
  so opening and saving a file does not rewrite constructs the author left
  untouched (escaped characters, table padding, blank lines).

## Roadmap

- Toolbar insert buttons for Mermaid and KaTeX (extensions already bundled).
- A VS Code extension reusing `@yfm-editor/core`.
- A signed and notarized build, so no `xattr` step is needed.

## Acknowledgments

This project stands on [Gravity UI](https://gravity-ui.com) and the
[Diplodoc](https://diplodoc.com) YFM toolchain (both by YANDEX LLC, MIT-licensed):

- [`@gravity-ui/markdown-editor`](https://github.com/gravity-ui/markdown-editor) — the editor core
- [`@gravity-ui/uikit`](https://github.com/gravity-ui/uikit) / [`@gravity-ui/components`](https://github.com/gravity-ui/components) — UI components and theming
- [`@diplodoc/transform`](https://github.com/diplodoc-platform/transform) and the `@diplodoc/*` extensions — YFM parsing and rendering

Packaged with [Tauri 2](https://v2.tauri.app). See
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) for the full attribution and
license notices of bundled dependencies.

## License

Released under the [MIT License](LICENSE) © 2026 Alexey Melekhin.

The bundled Gravity UI and Diplodoc packages are also MIT-licensed; their
copyright and permission notices are preserved in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) in accordance with their
license terms.
