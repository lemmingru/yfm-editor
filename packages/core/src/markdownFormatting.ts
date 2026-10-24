import type {EscapeConfig, ExtensionAuto, SerializerNodeToken} from '@gravity-ui/markdown-editor';
import {Plugin} from '@gravity-ui/markdown-editor/pm/state';
import {
  HtmlAttr,
  HtmlNode,
  TableNode,
  headingNodeName,
  renderYfmHeadingAttributes,
  renderYfmHeadingMarkup,
} from '@gravity-ui/markdown-editor/specs';
import {
  CellAlign,
  TableAttrs,
} from '@gravity-ui/markdown-editor/_/extensions/markdown/Table/TableSpecs/const.js';

/**
 * Characters the serializer escapes anywhere in a text run.
 *
 * The upstream default also covers `[ ] + > < ^ { } $ |`. Those either open a
 * construct only at the start of a line (`+`, `>` — handled by the serializer's
 * separate start-of-line pass) or belong to YFM syntax that needs a specific
 * shape to trigger (`{% %}`, `$…$`, `[text](url)`, `<tag>`). Escaping them
 * everywhere turns ordinary prose like `2 + 2` or `5 > 3` into `2 \+ 2` and
 * `5 \> 3` on every save. What stays is what changes meaning on its own:
 * code spans, emphasis and strikethrough. Underscores are handled by the
 * serializer, which skips them inside words.
 *
 * A backslash only starts an escape when ASCII punctuation or a line end
 * follows it, so `C:\Users` survives as written instead of becoming
 * `C:\\Users`.
 */
export const wysiwygEscapeConfig: EscapeConfig = {
  commonEscape: /[`*~]|\\(?=[!-\/:-@[-`{-~]|$)/g,
};

/**
 * Marks an html block that directly followed the previous block in the source,
 * with no blank line in between (the `<!-- meta: ... -->` convention).
 */
const htmlBlockTightAttr = 'data-tight-above';

/**
 * Marks a cell whose column carried an alignment marker in the source. Without
 * it a plain `| --- |` delimiter row is indistinguishable from `| :--- |`,
 * because the parser falls back to left alignment for unaligned columns.
 */
const cellAlignExplicitAttr = 'data-align-explicit';

function alignDelimiter(attrs: Record<string, unknown>): string {
  switch (attrs[TableAttrs.CellAlign]) {
    case CellAlign.Center:
      return ':---:';
    case CellAlign.Right:
      return '---:';
    default:
      return attrs[cellAlignExplicitAttr] ? ':---' : '---';
  }
}

/**
 * Cells are inline-only, so nothing inside them can start a block construct and
 * start-of-line escaping is pure noise. A pipe is the one character that still
 * has to be escaped here — unescaped it would split the row into more cells —
 * and GFM requires that even inside code spans, so the whole cell is treated
 * alike once its inline content has been written.
 */
const serializeTableCell: SerializerNodeToken = (state, node) => {
  state.write('| ');
  const contentStart = state.out.length;
  state.renderInline(node, false);
  state.out =
    state.out.slice(0, contentStart) + state.out.slice(contentStart).replace(/\|/g, '\\|');
  state.write(' ');
  state.closeBlock(node);
};

/**
 * The line a markdown-it block ends on, taken from the nearest preceding token
 * that carries a source map (closing tokens usually don't).
 */
function precedingBlockEndLine(tokens: {map?: [number, number] | null}[], index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    const map = tokens[i].map;
    if (map) return map[1];
  }
  return -1;
}

/**
 * Keeps WYSIWYG round-trips diff-free for documents kept under version control.
 *
 * The upstream serializer rewrites constructs that are already valid markdown:
 * it escapes characters that are only special at the start of a line even when
 * they sit inside a heading or a table cell, strips the padding from table
 * pipes, and inserts blank lines the author didn't write. None of that changes
 * how the document renders, but all of it shows up in `git diff`.
 */
export const GitFriendlyFormatting: ExtensionAuto = (builder) => {
  // The upstream image view replaces a failed image with plain Markdown text,
  // dropping its size/title and marking a freshly opened document as edited.
  // Offline or protected images must remain editable image nodes: loading is
  // a view concern and must never rewrite the document.
  builder.addPlugin(() => new Plugin({
    filterTransaction: (tr) => tr.getMeta('image-load-failed') === undefined,
  }));

  // Heading text is preceded by `# ` on the line, so `1.`, `-` or `#` at its
  // start cannot open a list, a rule or a nested heading — escaping is noise.
  builder.overrideNodeSerializerSpec(headingNodeName, () => (state, node, parent, index) => {
    renderYfmHeadingMarkup(state, node, parent, index);
    state.renderInline(node, false);
    renderYfmHeadingAttributes(state, node, parent, index);
    state.closeBlock(node);
  });

  // Upstream writes an explicit '\n' on top of the blank line that block
  // separation already produces, which leaves two blank lines before a table.
  builder.overrideNodeSerializerSpec(TableNode.Table, () => (state, node) => {
    state.flushClose();
    state.ensureNewLine();
    state.setNoAutoBlank();
    state.renderContent(node);
    state.unsetNoAutoBlank();
    state.ensureNewLine();
    state.closeBlock(node);
  });

  builder.overrideNodeSerializerSpec(TableNode.Head, () => (state, node) => {
    state.renderContent(node);
    node.firstChild?.forEach((cell) => {
      state.write(`| ${alignDelimiter(cell.attrs)} `);
    });
    state.write('|');
    state.ensureNewLine();
    state.closeBlock(node);
  });

  for (const cell of [TableNode.HeaderCell, TableNode.DataCell]) {
    builder.overrideNodeSpec(cell, (prev) => ({
      ...prev,
      attrs: {...prev.attrs, [cellAlignExplicitAttr]: {default: false}},
    }));
    builder.overrideMarkdownTokenParserSpec(cell, (prev) => ({
      ...prev,
      getAttrs: (token, tokens, index) => ({
        ...prev.getAttrs?.(token, tokens, index),
        [cellAlignExplicitAttr]: (token.attrGet('style') ?? '').includes('text-align:'),
      }),
    }));
    builder.overrideNodeSerializerSpec(cell, () => serializeTableCell);
  }

  // The html extension is skipped when markdown HTML is disabled.
  if (!builder.hasNodeSpec(HtmlNode.Block)) return;

  // Metadata comments are written directly under the block they annotate; the
  // serializer would otherwise detach them with a blank line.
  builder.overrideNodeSpec(HtmlNode.Block, (prev) => ({
    ...prev,
    attrs: {...prev.attrs, [htmlBlockTightAttr]: {default: false}},
  }));

  builder.overrideMarkdownTokenParserSpec(HtmlNode.Block, (prev) => ({
    ...prev,
    getAttrs: (token, tokens, index) => ({
      ...prev.getAttrs?.(token, tokens, index),
      [htmlBlockTightAttr]: Boolean(
        token.map && token.map[0] === precedingBlockEndLine(tokens, index),
      ),
    }),
  }));

  builder.overrideNodeSerializerSpec(HtmlNode.Block, () => (state, node) => {
    if (node.attrs[htmlBlockTightAttr]) state.flushClose(1);
    state.write(node.attrs[HtmlAttr.Content]);
    state.ensureNewLine();
    state.closeBlock(node);
  });
};
