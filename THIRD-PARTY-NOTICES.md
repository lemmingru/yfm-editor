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

## Inter — SIL Open Font License 1.1

Inter is bundled via `@fontsource/inter`.

```text
Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) Inter-Italic[opsz,wght].ttf: Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
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
