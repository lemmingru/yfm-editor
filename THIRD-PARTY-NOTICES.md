# Third-Party Notices

YFM Editor is built on open-source software. Binaries produced from this
repository bundle the projects listed below. Each is distributed under its own
license; the full license text of every npm and Cargo dependency is available
in its package (`node_modules/<pkg>/LICENSE`, or the crate source) and in
`package-lock.json` / `src-tauri/Cargo.lock`.

The core editing experience is provided by **Gravity UI** and the **Diplodoc**
YFM toolchain, both by YANDEX LLC and both MIT-licensed. Their copyright and
permission notices are reproduced below as required by the MIT License.

## Gravity UI (YANDEX LLC) — MIT

- `@gravity-ui/markdown-editor` — Copyright (c) 2022 YANDEX LLC
- `@gravity-ui/uikit` — Copyright (c) 2021 YANDEX LLC
- `@gravity-ui/components` — Copyright (c) 2023 YANDEX LLC
- `@gravity-ui/markdown-editor-latex-extension` — Copyright (c) 2022 YANDEX LLC

## Diplodoc / YFM (YANDEX LLC) — MIT

- `@diplodoc/transform` — Copyright (c) 2020 YANDEX LLC
- `@diplodoc/cut-extension`, `@diplodoc/file-extension`,
  `@diplodoc/folding-headings-extension`, `@diplodoc/html-extension`,
  `@diplodoc/latex-extension`, `@diplodoc/mermaid-extension`,
  `@diplodoc/quote-link-extension`, `@diplodoc/tabs-extension` — Copyright (c) YANDEX LLC

### MIT License (applies to the Gravity UI and Diplodoc packages above)

```
The MIT License (MIT)

Copyright (c) YANDEX LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Other notable dependencies

| Package | License | Copyright |
| --- | --- | --- |
| Tauri (`@tauri-apps/*`, `tauri`, `tauri-plugin-*`) | Apache-2.0 OR MIT | Tauri Programme within The Commons Conservancy |
| `react`, `react-dom` | MIT | Copyright (c) Meta Platforms, Inc. and affiliates |
| `katex` | MIT | Copyright (c) 2013-2020 Khan Academy and other contributors |
| `markdown-it` | MIT | Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin |
| `highlight.js` | BSD-3-Clause | Copyright (c) 2006, Ivan Sagalaev |
| `lowlight` | MIT | Copyright (c) 2016 Titus Wormer |

This list is not exhaustive. See `package-lock.json` and
`src-tauri/Cargo.lock` for the complete dependency graph and their licenses.
