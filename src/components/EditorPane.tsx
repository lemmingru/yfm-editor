import React from 'react';
import {MarkdownEditorView, useMarkdownEditor} from '@gravity-ui/markdown-editor';
import type {EscapeConfig, RenderPreview, ToolbarsPreset, ToolbarOrders} from '@gravity-ui/markdown-editor';
import {LatexExtension} from '@gravity-ui/markdown-editor-latex-extension';
import {
  latexBlockItemMarkup,
  latexBlockItemView,
  latexBlockItemWysiwyg,
  latexInlineItemMarkup,
  latexInlineItemView,
  latexInlineItemWysiwyg,
  latexListItemView,
} from '@gravity-ui/markdown-editor-latex-extension/configs';
import {
  mermaidItemMarkup,
  mermaidItemView,
  mermaidItemWysiwyg,
} from '@gravity-ui/markdown-editor/_/modules/toolbars/items.js';
import {Mermaid} from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
// The `full` preset ships every opensource toolbar button except the formula
// (math/LaTeX) and Mermaid ones, which the editor supports but leaves out of
// the default layout. We extend it here so those buttons appear on the toolbar.
import {full} from '@gravity-ui/markdown-editor/_/modules/toolbars/presets.js';
import transform from '@diplodoc/transform';
import defaultPlugins from '@diplodoc/transform/lib/plugins';
import {transform as latexTransform} from '@diplodoc/latex-extension';
import {useLatex} from '@diplodoc/latex-extension/react';
import {transform as mermaidTransform} from '@diplodoc/mermaid-extension';
import {useMermaid} from '@diplodoc/mermaid-extension/react';
import type {EditingMode} from '../preferences';

// Keep Diplodoc's full YFM support (including multiline tables) and add rich blocks.
// `bundle`/`validate` are disabled because we render client-side (no file output).
const previewPlugins = [
  ...defaultPlugins,
  latexTransform({bundle: false, validate: false}),
  mermaidTransform({bundle: false}),
];

const wysiwygEscapeConfig: EscapeConfig = {
  // Preserve issue tags like [ЭКСП] / [ЛС] when WYSIWYG re-serializes markdown.
  commonEscape: /[`\^+*\\|~{}<>$]/g,
};

// A formula dropdown (inline + block) placed right after the code button, so it
// sits in the same group as `code`, mirroring Yandex Tracker's toolbar layout.
const mathListOrder = {id: 'math', items: ['mathInline', 'mathBlock']};
const mermaidOrder = 'mermaid';

const withRichBlocks = (orders: ToolbarOrders): ToolbarOrders =>
  orders.map((group) =>
    group.some((item) => typeof item !== 'string' && item.id === 'code')
      ? [...group, mathListOrder, mermaidOrder]
      : group,
  );

// `full` gives us the standard toolbar; we register rich items/actions and
// inject the formula and diagram buttons into both main toolbars.
const toolbarsPreset: ToolbarsPreset = {
  items: {
    ...full.items,
    mathInline: {
      view: latexInlineItemView,
      wysiwyg: latexInlineItemWysiwyg,
      markup: latexInlineItemMarkup,
    },
    mathBlock: {
      view: latexBlockItemView,
      wysiwyg: latexBlockItemWysiwyg,
      markup: latexBlockItemMarkup,
    },
    math: {view: latexListItemView},
    mermaid: {
      view: mermaidItemView,
      wysiwyg: mermaidItemWysiwyg,
      markup: mermaidItemMarkup,
    },
  },
  orders: {
    ...full.orders,
    wysiwygMain: withRichBlocks(full.orders.wysiwygMain),
    markupMain: withRichBlocks(full.orders.markupMain),
  },
};

// Load the async KaTeX runtime once; it registers itself via window.latexJsonp,
// serving both the editor's math node views and the split-preview hydration.
// (Styles are imported statically in main.tsx.)
function loadLatexRuntime(): void {
  import('@diplodoc/latex-extension/runtime');
}

// Mermaid uses the same async JSONP pattern as the LaTeX extension.
function loadMermaidRuntime(): void {
  import('@diplodoc/mermaid-extension/runtime');
}

function renderHtml(markup: string): string {
  try {
    const {result} = transform(markup, {plugins: previewPlugins, needTitle: false});
    return result.html;
  } catch (e) {
    return `<pre>Preview error: ${(e as Error).message}</pre>`;
  }
}

/** Split-preview pane: renders YFM to HTML and hydrates rich client-side blocks. */
function Preview({markup}: {markup: string}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const html = React.useMemo(() => renderHtml(markup), [markup]);
  const runLatex = useLatex();
  const runMermaid = useMermaid();

  React.useEffect(() => {
    loadLatexRuntime();
    loadMermaidRuntime();
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('.yfm-latex'));
    if (nodes.length) runLatex({nodes, throwOnError: false});
  }, [html, runLatex]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('.mermaid'));
    if (nodes.length) runMermaid({startOnLoad: false}, {nodes}).catch(() => {});
  }, [html, runMermaid]);

  return <div ref={ref} className="yfm preview" dangerouslySetInnerHTML={{__html: html}} />;
}

// The WYSIWYG editor serializes visually-identical documents to slightly
// different strings (e.g. an empty doc as "" or "\n"). Trimming trailing
// whitespace/newlines keeps the dirty comparison stable across undo/redo.
const normalizeMarkup = (s: string): string => s.replace(/\r\n/g, '\n').replace(/\s+$/, '');

type Props = {
  /** Initial markup; the component is remounted (via key) when the document changes. */
  markup: string;
  /** Initial editing mode (wysiwyg / markup); applied at mount. */
  mode: EditingMode;
  /** Reports whether the document differs from the last saved/loaded state. */
  onDirtyChange: (dirty: boolean) => void;
  /** Called when the editor emits a submit (Cmd+Enter). */
  onSubmit: () => void;
  /** Exposes a getter for the current markup so the parent can save. */
  registerGetValue: (fn: () => string) => void;
  /** Exposes a callback the parent calls after a save to reset the clean baseline. */
  registerMarkSaved: (fn: () => void) => void;
  /** Exposes a command that copies the current editor context for an agent. */
  registerCopyAgentContext: (fn: (filePath: string) => Promise<CopyAgentContextResult>) => void;
};

export type CopyAgentContextResult = 'copied' | 'no-context' | 'use-markup-mode';

type AgentContext = {
  startLine: number;
  endLine: number;
  text: string;
};

type CodeMirrorLike = {
  state: {
    doc: {
      lineAt(pos: number): {number: number; from: number; to: number; text: string};
      sliceString(from: number, to: number): string;
    };
    selection: {main: {from: number; to: number; empty: boolean; head: number}};
  };
};

type WysiwygViewLike = {
  state: {
    doc: {
      textBetween(from: number, to: number, blockSeparator?: string): string;
      slice(from: number, to: number, includeParents?: boolean): {content: unknown};
    };
    selection: {
      from: number;
      to: number;
      empty: boolean;
      content(): {content: unknown};
      $from: {parent: {textContent: string}};
    };
  };
};

type WysiwygEditorLike = {
  serializer: {serialize(content: unknown): string};
};

function countNewlines(text: string): number {
  return (text.match(/\n/g) || []).length;
}

function contextLinesForRange(markup: string, from: number, to: number): AgentContext {
  const safeFrom = Math.max(0, Math.min(from, markup.length));
  const safeTo = Math.max(safeFrom, Math.min(to, markup.length));
  const effectiveEnd = safeTo > safeFrom ? safeTo - 1 : safeFrom;
  const lineStart = markup.lastIndexOf('\n', Math.max(0, safeFrom - 1)) + 1;
  const nextBreak = markup.indexOf('\n', effectiveEnd);
  const lineEnd = nextBreak === -1 ? markup.length : nextBreak;

  return {
    startLine: countNewlines(markup.slice(0, lineStart)) + 1,
    endLine: countNewlines(markup.slice(0, effectiveEnd)) + 1,
    text: markup.slice(lineStart, lineEnd),
  };
}

function findContextInMarkup(markup: string, text: string): AgentContext | null {
  const candidates = Array.from(new Set([text, text.trim()].filter(Boolean)));
  for (const candidate of candidates) {
    const index = markup.indexOf(candidate);
    if (index !== -1) return contextLinesForRange(markup, index, index + candidate.length);
  }
  for (const candidate of candidates) {
    const context = findContextByNonEmptyLines(markup, candidate);
    if (context) return context;
  }
  for (const candidate of candidates) {
    const context = findContextByMarkdownTextLines(markup, candidate);
    if (context) return context;
  }
  return null;
}

function findContextByNonEmptyLines(markup: string, text: string): AgentContext | null {
  const needle = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (needle.length < 2) return null;

  const lines = markup.replace(/\r\n/g, '\n').split('\n');
  for (let start = 0; start < lines.length; start++) {
    let matched = 0;
    let end = start;

    for (; end < lines.length && matched < needle.length; end++) {
      const line = lines[end].trim();
      if (!line) continue;
      if (line !== needle[matched]) break;
      matched++;
    }

    if (matched === needle.length) {
      return {
        startLine: start + 1,
        endLine: end,
        text: lines.slice(start, end).join('\n'),
      };
    }
  }

  return null;
}

function normalizeMarkdownLineForMatch(line: string): string {
  return line
    .trim()
    .replace(/^>\s*/, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-+*]\s+\[[ xX]\]\s+/, '')
    .replace(/^[-+*]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^\*\*(.*?)\*\*$/, '$1')
    .replace(/^__(.*?)__$/, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function findContextByMarkdownTextLines(markup: string, text: string): AgentContext | null {
  const needle = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(normalizeMarkdownLineForMatch)
    .filter(Boolean);
  if (needle.length < 2) return null;

  const lines = markup.replace(/\r\n/g, '\n').split('\n');
  const normalizedLines = lines.map(normalizeMarkdownLineForMatch);

  for (let start = 0; start < normalizedLines.length; start++) {
    let matched = 0;
    let end = start;

    for (; end < normalizedLines.length && matched < needle.length; end++) {
      const line = normalizedLines[end];
      if (!line) continue;
      if (line !== needle[matched]) break;
      matched++;
    }

    if (matched === needle.length) {
      return {
        startLine: start + 1,
        endLine: end,
        text: lines.slice(start, end).join('\n'),
      };
    }
  }

  return null;
}

function getMarkupContext(cm: CodeMirrorLike): AgentContext {
  const {doc, selection} = cm.state;
  const from = Math.min(selection.main.from, selection.main.to);
  const to = Math.max(selection.main.from, selection.main.to);

  if (selection.main.empty) {
    const line = doc.lineAt(selection.main.head);
    return {startLine: line.number, endLine: line.number, text: line.text};
  }

  const startLine = doc.lineAt(from);
  const endLine = doc.lineAt(Math.max(from, to - 1));
  return {
    startLine: startLine.number,
    endLine: endLine.number,
    text: doc.sliceString(startLine.from, endLine.to),
  };
}

function getWysiwygContext(
  markup: string,
  view?: WysiwygViewLike,
  wysiwygEditor?: WysiwygEditorLike,
): AgentContext | null {
  if (!view) return null;
  const {doc, selection} = view.state;
  const selectedMarkup =
    !selection.empty && wysiwygEditor
      ? wysiwygEditor.serializer.serialize(selection.content().content)
      : '';
  const selectedText = selection.empty
    ? selection.$from.parent.textContent
    : doc.textBetween(selection.from, selection.to, '\n');

  return (
    findContextInMarkup(markup, selectedMarkup) ||
    findContextInMarkup(markup, selectedText) ||
    findContextInMarkup(markup, window.getSelection()?.toString() || '')
  );
}

function markdownFenceFor(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((ticks) => ticks.length));
  return '`'.repeat(Math.max(3, longest + 1));
}

function formatAgentContext(filePath: string, context: AgentContext): string {
  const location =
    context.startLine === context.endLine
      ? `${filePath}:${context.startLine}`
      : `${filePath}:${context.startLine}-${context.endLine}`;
  const fence = markdownFenceFor(context.text);
  return `${location}\n\n${fence}markdown\n${context.text}\n${fence}`;
}

export function EditorPane({
  markup,
  mode,
  onDirtyChange,
  onSubmit,
  registerGetValue,
  registerMarkSaved,
  registerCopyAgentContext,
}: Props) {
  const renderPreview = React.useCallback<RenderPreview>(
    ({getValue}) => <Preview markup={getValue()} />,
    [],
  );

  const editor = useMarkdownEditor({
    preset: 'full',
    md: {html: true, linkify: true},
    initial: {markup, mode},
    markupConfig: {renderPreview, splitMode: 'horizontal'},
    wysiwygConfig: {
      escapeConfig: wysiwygEscapeConfig,
      extensions: (builder) => {
        builder.use(LatexExtension, {
          loadRuntimeScript: loadLatexRuntime,
          katexOptions: {throwOnError: false},
        });
        builder.use(Mermaid, {
          loadRuntimeScript: loadMermaidRuntime,
        });
      },
    },
  });

  // Keep the latest parent callbacks in refs so the change subscription below
  // depends only on `editor` and never re-subscribes / re-captures the baseline
  // on unrelated re-renders (which would let the baseline drift to the current
  // text and make the dirty flag non-deterministic).
  const onDirtyChangeRef = React.useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  const onSubmitRef = React.useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Baseline = the editor's own serialization of the loaded document, captured
  // once per editor instance. Comparing against it means undoing back to the
  // saved state (or emptying a new doc) reliably clears the dirty flag.
  const baselineRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    baselineRef.current = normalizeMarkup(editor.getValue());
    const emitDirty = () =>
      onDirtyChangeRef.current(normalizeMarkup(editor.getValue()) !== baselineRef.current);
    const handleSubmit = () => onSubmitRef.current();
    editor.on('change', emitDirty);
    editor.on('submit', handleSubmit);
    return () => {
      editor.off('change', emitDirty);
      editor.off('submit', handleSubmit);
    };
  }, [editor]);

  React.useEffect(() => {
    registerGetValue(() => editor.getValue());
  }, [registerGetValue, editor]);

  React.useEffect(() => {
    registerMarkSaved(() => {
      baselineRef.current = normalizeMarkup(editor.getValue());
      onDirtyChangeRef.current(false);
    });
  }, [registerMarkSaved, editor]);

  React.useEffect(() => {
    registerCopyAgentContext(async (filePath) => {
      const markup = editor.getValue();
      const editorInternals = editor as unknown as {
        cm?: CodeMirrorLike;
        _wysiwygView?: WysiwygViewLike;
        wysiwygEditor?: WysiwygEditorLike;
      };
      const context =
        editor.currentMode === 'markup'
          ? editorInternals.cm && getMarkupContext(editorInternals.cm)
          : getWysiwygContext(
              markup,
              editorInternals._wysiwygView,
              editorInternals.wysiwygEditor,
            );

      if (!context) return editor.currentMode === 'wysiwyg' ? 'use-markup-mode' : 'no-context';
      await navigator.clipboard.writeText(formatAgentContext(filePath, context));
      return 'copied';
    });
  }, [registerCopyAgentContext, editor]);

  return (
    <MarkdownEditorView
      className="main__editor"
      editor={editor}
      toolbarsPreset={toolbarsPreset}
      stickyToolbar
      autofocus
    />
  );
}
