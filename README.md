# YFM Editor

A native macOS (and cross-platform) editor for Markdown files written in
[YFM](https://ydocs.tech) (Yandex Flavored Markdown), built on
[`@gravity-ui/markdown-editor`](https://github.com/gravity-ui/markdown-editor)
and packaged with [Tauri 2](https://v2.tauri.app).

Supports WYSIWYG + raw-markup + split-preview editing, with native handling of
YFM **multiline tables**, **cuts** (`{% cut %}`), **notes** (`{% note %}`), tabs,
files, LaTeX and Mermaid.

A single-document editor: open one `.md` file at a time via the native menu or by
double-clicking it in Finder (it can be set as the default `.md` handler). The UI
renders in the system WebView (WKWebView on macOS); file reads/writes go through
the Rust core, so there is no HTTP server and no exposed filesystem API.

## Requirements

- Node.js 18+ (tested on Node 22)
- Rust toolchain (`rustup`, stable) — for building the native app
- Xcode Command Line Tools (macOS)

## Install

```bash
git clone https://github.com/alxmelekhin/yfm-editor.git
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

Output lands in `src-tauri/target/release/bundle/`. To make it the default Markdown
handler: in Finder, right-click a `.md` file → Get Info → Open with → choose
**YFM Editor** → Change All.

## Use

- **File ▸ New** (⌘N), **Open…** (⌘O), **Save** (⌘S), **Save As…** (⇧⌘S) from the
  native menu. **Preferences…** (⌘,) sets theme and the default editor mode.
- Edit in **markup** (default) or **WYSIWYG**, or open the **split preview** using
  the editor toolbar.
- A "● unsaved" marker and the window title dot indicate unsaved changes; you are
  warned before opening another file or closing the window with unsaved edits.
- Double-clicking a `.md` file in Finder opens it; if the app is already running
  the open is near-instant (the process stays resident).

## How it works

- `src-tauri/` is the Rust core: `read_file` / `write_file` commands over `std::fs`,
  the native macOS menu (emitting `menu-action` events), single-instance handling,
  and `RunEvent::Opened` for Finder "open with" (buffered for cold starts via
  `frontend_ready`).
- `src/api/client.ts` calls those commands through Tauri `invoke` and uses
  `@tauri-apps/plugin-dialog` for native open/save dialogs.
- `src/App.tsx` is the single-document shell: state, native-menu wiring, window
  title, and the unsaved-changes guard.
- `src/components/EditorPane.tsx` wraps `useMarkdownEditor` with the `full` preset
  (all YFM extensions). The split preview renders HTML via `@diplodoc/transform`.

## Roadmap

- Export to HTML / PDF (menu items present as stubs).
- Toolbar insert buttons for Mermaid and KaTeX (extensions already bundled).

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
