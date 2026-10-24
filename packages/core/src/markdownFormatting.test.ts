import {describe, expect, it} from 'vitest';
import type {Extension} from '@gravity-ui/markdown-editor';
import {ExtensionsManager} from '@gravity-ui/markdown-editor/_/core/index.js';
import {FullSpecsPreset} from '@gravity-ui/markdown-editor/_/presets/full-specs.js';
import {MermaidSpecs} from '@gravity-ui/markdown-editor/_/extensions/additional/Mermaid/MermaidSpecs/index.js';
import {LatexSpecsExtension} from '@gravity-ui/markdown-editor-latex-extension/specs';
import {GitFriendlyFormatting, wysiwygEscapeConfig} from './markdownFormatting';

/** The same document model `EditorPane` builds, without the UI layer. */
const extensions: Extension = (builder) => {
  builder.use(FullSpecsPreset, {color: {}});
  builder.use(LatexSpecsExtension, {});
  builder.use(MermaidSpecs, {});
  builder.use(GitFriendlyFormatting);
};

/**
 * Parses markup into the WYSIWYG document model and writes it back out, the
 * way the editor does when a file is opened and then saved. The spec presets
 * carry the parser and serializer the `full` bundle preset builds on.
 */
function roundTrip(markup: string): string {
  const {markupParser, serializer} = ExtensionsManager.process(extensions, {
    mdOpts: {html: true, linkify: true, breaks: true},
  });
  const markup2 = serializer.serialize(markupParser.parse(markup), wysiwygEscapeConfig);
  // The serializer omits the final newline; the file on disk keeps it.
  return markup2.replace(/\n*$/, '\n');
}

const documents: Record<string, string> = {
  'numbered heading': '# 1. Заголовок\n',
  'nested numbered heading': '## 1.1. Заголовок\n',
  'heading with a link, code and a bracketed tag':
    '## [`REQ-1`](https://example.com/REQ-1) `Черновик` [ЛС] Текст\n',
  'heading with emphasis': '# **жирный** и `код`\n',
  'metadata comment attached to a heading': '# Заголовок\n<!-- meta: key=REQ-1 -->\n',
  'metadata comment attached to a paragraph': 'Текст.\n<!-- meta: key=REQ-1 -->\n',
  'comment separated by a blank line': '# Заголовок\n\n<!-- meta: key=REQ-1 -->\n',
  'stacked comments': '# Заголовок\n<!-- meta: key=REQ-1 -->\n<!-- meta: kind=requirement -->\n',
  'comment at the top of a file': '<!-- meta: key=REQ-1 -->\n\n# Заголовок\n',
  'unaligned table': '| a | b |\n| --- | --- |\n| 1 | 2 |\n',
  'aligned table': '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n',
  'table after a paragraph': 'Текст:\n\n| a |\n| --- |\n| 1 |\n',
  'table cell starting with a number': '| a |\n| --- |\n| 1. вариант |\n',
  'table cell with a pipe': '| a |\n| --- |\n| x \\| y |\n',
  'table cell with a pipe inside code': '| a |\n| --- |\n| `код \\| с чертой` |\n',
  'table cell with unescaped punctuation': '| a |\n| --- |\n| 5 > 3 и {x} и $100 |\n',
  'ordered list': '1. один\n2. два\n',
  'bullet list': '- один\n- два\n',
  'paragraph starting with a number': '1\\. не список\n',
  'paragraph starting with a dash': '\\- не список\n',
  'arithmetic in prose': 'Скорость 2 + 2 равна 4.\n',
  'comparisons in prose': 'Диапазон 5 > 3 и 2 < 4.\n',
  'braces and carets in prose': 'Значение {x} при a^2.\n',
  'currency in prose': 'От $100 до $200.\n',
  'pipe in prose': 'Текст с | вертикальной чертой.\n',
  'bracketed tags in prose': 'Ссылка [ЛС] и [ЭКСП].\n',
  'windows path in prose': 'Путь C:\\Users\\test.\n',
  'ranges and units in prose': 'Диапазон 20–60 км/ч, уклон -6 %, 3,58 м/с³.\n',
  'emphasis and code in prose': '**Жирный**, *курсив*, ~~зачёркнутый~~ и `код`.\n',
  'escaped asterisk in prose': 'Escape \\* звёздочка.\n',
  'inline formula': 'Формула: $x^2 + y^2$.\n',
  'block formula': '$$E = mc^2\n$$\n',
  'Mermaid diagram': '```mermaid\ngraph LR\n  A[Редактор] --> B[Предпросмотр]\n```\n',
  'code containing a shorter fence': '````markdown\n```js\nconst x = 1;\n```\n````\n',
  'YFM note': '{% note info "Важно" %}\n\nПримечание.\n\n{% endnote %}\n',
  'YFM cut': '{% cut "Подробности" %}\n\nСкрытый текст.\n\n{% endcut %}\n',
  'YFM tabs':
    '{% list tabs %}\n\n- Первая\n\n  Первая вкладка.\n\n- Вторая\n\n  Вторая вкладка.\n\n{% endlist %}\n',
};

describe('WYSIWYG markdown round-trip', () => {
  for (const [name, markup] of Object.entries(documents)) {
    it(`leaves ${name} untouched`, () => {
      expect(roundTrip(markup)).toBe(markup);
    });
  }

  // Characters that stay escaped keep their meaning; the point is that writing
  // the document out again does not keep adding backslashes.
  it('is idempotent for constructs it does rewrite', () => {
    for (const markup of ['Звёздочка 2*3.\n', 'Тильда ~ одна.\n', 'Слеш перед точкой \\. тут.\n']) {
      const once = roundTrip(markup);
      expect(roundTrip(once)).toBe(once);
    }
  });

  // Files saved by earlier versions carry escapes this editor added itself.
  it('drops escapes it would no longer add', () => {
    expect(roundTrip('# 1\\. Заголовок\n')).toBe('# 1. Заголовок\n');
    expect(roundTrip('Скорость 2 \\+ 2.\n')).toBe('Скорость 2 + 2.\n');
  });
});
