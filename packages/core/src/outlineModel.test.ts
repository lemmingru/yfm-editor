import {describe, expect, it} from 'vitest';
import type {Extension} from '@gravity-ui/markdown-editor';
import {ExtensionsManager} from '@gravity-ui/markdown-editor/_/core/index.js';
import {FullSpecsPreset} from '@gravity-ui/markdown-editor/_/presets/full-specs.js';
import {EditorState, TextSelection} from '@gravity-ui/markdown-editor/pm/state';
import {EditorView} from '@gravity-ui/markdown-editor/pm/view';
import {GitFriendlyFormatting, wysiwygEscapeConfig} from './markdownFormatting';
import {OutlineSourceLines, buildOutlineTree, collectHeadings, navigateVisualHeading, previewHeadingText, revealHeading} from './outlineModel';

const extensions: Extension = (builder) => {
  builder.use(FullSpecsPreset, {color: {}});
  builder.use(GitFriendlyFormatting);
  builder.use(OutlineSourceLines);
};
const {markupParser, serializer} = ExtensionsManager.process(extensions, {
  mdOpts: {html: true, linkify: true, breaks: true},
});

describe('document outline positions', () => {
  it('uses parsed headings, including Setext and formatted text, and ignores code and HTML comments', () => {
    const source = '# Intro\n\n```md\n# not a heading\n```\n\n<!--\n# hidden\n-->\n\nSecond *section*\n---------------\n\n### [Link](https://example.com) and `code` {#custom}\n';
    expect(collectHeadings(markupParser.parse(source)).map(({title, level, line}) => ({title, level, line})))
      .toEqual([
        {title: 'Intro', level: 1, line: 0},
        {title: 'Second section', level: 2, line: 10},
        {title: 'Link and code', level: 3, line: 13},
      ]);
  });

  it('maps headings inside cuts, notes, quotes and tabs to their actual source lines', () => {
    const lines = [
      '# Intro', '', '{% cut "Details" %}', '', '## In cut', '', '{% endcut %}', '',
      '{% note info %}', '', '## In note', '', '{% endnote %}', '', '> ## In quote', '',
      '{% list tabs %}', '', '- First', '', '  ## First tab heading', '',
      '- Second', '', '  ## Second tab heading', '', '{% endlist %}',
    ];
    expect(collectHeadings(markupParser.parse(lines.join('\n'))).map(({title, line}) => ({title, line})))
      .toEqual([
        {title: 'Intro', line: 0}, {title: 'In cut', line: 4}, {title: 'In note', line: 10},
        {title: 'In quote', line: 14}, {title: 'First tab heading', line: 20},
        {title: 'Second tab heading', line: 24},
      ]);
  });

  it('keeps duplicate titles as distinct positions and rebuilds source lines after edits', () => {
    const original = '# Same\n\nText\n\n# Same\n';
    const first = collectHeadings(markupParser.parse(original));
    expect(first.map(({line}) => line)).toEqual([0, 4]);
    expect(first[0].pos).not.toBe(first[1].pos);
    const changed = collectHeadings(markupParser.parse(`Extra\n\n${original}`));
    expect(changed.map(({line}) => line)).toEqual([2, 6]);
  });

  it('builds a hierarchy with skipped heading levels', () => {
    const headings = collectHeadings(markupParser.parse('# A\n\n#### B\n\n## C\n\n# D\n'));
    const tree = buildOutlineTree(headings);
    expect(tree.map(({title}) => title)).toEqual(['A', 'D']);
    expect(tree[0].children.map(({title}) => title)).toEqual(['B', 'C']);
  });

  it('does not serialize navigation metadata into Markdown', () => {
    const source = '# Title {#anchor}\n\n## Another\n';
    expect(serializer.serialize(markupParser.parse(source), wysiwygEscapeConfig)).toBe(source.trimEnd());
  });

  it('reveals nested cuts and selects the tab by its panel rather than a placeholder DOM id', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="yfm-cut"><div class="yfm-cut-title"></div><div class="yfm-tabs">' +
      '<div class="yfm-tab" id="unknown" data-diplodoc-id="first" aria-controls="panel1"></div>' +
      '<div class="yfm-tab" id="unknown" data-diplodoc-id="second" aria-controls="panel2"></div>' +
      '<div class="yfm-tab-panel" id="panel1" aria-labelledby="first"></div>' +
      '<div class="yfm-tab-panel" id="panel2" aria-labelledby="second"><h3>Target</h3></div>' +
      '</div></div>';
    const cut = root.querySelector<HTMLElement>('.yfm-cut')!;
    const secondTab = root.querySelector<HTMLElement>('[aria-controls="panel2"]')!;
    root.querySelector('.yfm-cut-title')!.addEventListener('click', () => cut.classList.add('yfm-cut-open'));
    secondTab.addEventListener('click', () => secondTab.setAttribute('data-diplodoc-is-active', 'true'));
    revealHeading(root.querySelector('h3')!, root);
    expect(cut.classList.contains('yfm-cut-open')).toBe(true);
    expect(secondTab.getAttribute('data-diplodoc-is-active')).toBe('true');
  });

  it('ignores the hidden copy of the title in a preview anchor', () => {
    const heading = document.createElement('h2');
    heading.innerHTML = '<a class="yfm-anchor" aria-hidden="true">Title</a>Title';
    expect(previewHeadingText(heading)).toBe('Title');
    expect(heading.textContent).toBe('TitleTitle');
  });

  it('navigates to the second identical visual heading after an edit without changing content', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const view = new EditorView(root, {state: EditorState.create({doc: markupParser.parse('# Same\n\n# Same\n')})});
    try {
      view.dispatch(view.state.tr.insertText('Added text', 1));
      const headings = collectHeadings(view.state.doc);
      const before = view.state.doc;
      navigateVisualHeading(view, headings[1], root);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.from).toBe(headings[1].pos + 1);
      expect(view.state.selection.$from.parent.textContent).toBe('Same');
      expect(view.state.doc).toBe(before);
    } finally {
      view.destroy();
      root.remove();
    }
  });

  it('unfolds containing heading sections without changing their Markdown or a preceding sibling section', () => {
    const root = document.createElement('div');
    const parsed = markupParser.parse('# A\n\n## B\n\n### Target\n\n# C\n');
    const headings = collectHeadings(parsed);
    let state = EditorState.create({doc: parsed});
    state = state.apply(state.tr.setNodeAttribute(headings[0].pos, 'folded', true)
      .setNodeAttribute(headings[1].pos, 'folded', true));
    const view = new EditorView(root, {state});
    try {
      const source = serializer.serialize(view.state.doc);
      navigateVisualHeading(view, headings[2], root);
      expect(view.state.doc.nodeAt(headings[0].pos)?.attrs.folded).toBe(false);
      expect(view.state.doc.nodeAt(headings[1].pos)?.attrs.folded).toBe(false);
      expect(serializer.serialize(view.state.doc)).toBe(source);
      view.dispatch(view.state.tr.setNodeAttribute(headings[0].pos, 'folded', true));
      navigateVisualHeading(view, headings[3], root);
      expect(view.state.doc.nodeAt(headings[0].pos)?.attrs.folded).toBe(true);
    } finally {
      view.destroy();
    }
  });
});
