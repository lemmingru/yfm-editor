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
// The `full` preset ships every opensource toolbar button except the formula
// (math/LaTeX) one, which the editor supports but leaves out of the default
// layout. We extend it here so the formula button appears on the toolbar.
import {full} from '@gravity-ui/markdown-editor/_/modules/toolbars/presets.js';
import transform from '@diplodoc/transform';
import defaultPlugins from '@diplodoc/transform/lib/plugins';
import {transform as latexTransform} from '@diplodoc/latex-extension';
import {useLatex} from '@diplodoc/latex-extension/react';
import type {EditingMode} from '../preferences';

// Keep Diplodoc's full YFM support (including multiline tables) and add LaTeX.
// `bundle`/`validate` are disabled because we render client-side (no file output).
const previewPlugins = [...defaultPlugins, latexTransform({bundle: false, validate: false})];

const wysiwygEscapeConfig: EscapeConfig = {
  // Preserve issue tags like [ЭКСП] / [ЛС] when WYSIWYG re-serializes markdown.
  commonEscape: /[`\^+*\\|~{}<>$]/g,
};

// A formula dropdown (inline + block) placed right after the code button, so it
// sits in the same group as `code`, mirroring Yandex Tracker's toolbar layout.
const mathListOrder = {id: 'math', items: ['mathInline', 'mathBlock']};

const withMath = (orders: ToolbarOrders): ToolbarOrders =>
  orders.map((group) =>
    group.some((item) => typeof item !== 'string' && item.id === 'code')
      ? [...group, mathListOrder]
      : group,
  );

// `full` gives us the standard toolbar; we register the math items/actions and
// inject the formula button into both the WYSIWYG and markup main toolbars.
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
  },
  orders: {
    ...full.orders,
    wysiwygMain: withMath(full.orders.wysiwygMain),
    markupMain: withMath(full.orders.markupMain),
  },
};

// Load the async KaTeX runtime once; it registers itself via window.latexJsonp,
// serving both the editor's math node views and the split-preview hydration.
// (Styles are imported statically in main.tsx.)
function loadLatexRuntime(): void {
  import('@diplodoc/latex-extension/runtime');
}

function renderHtml(markup: string): string {
  try {
    const {result} = transform(markup, {plugins: previewPlugins, needTitle: false});
    return result.html;
  } catch (e) {
    return `<pre>Preview error: ${(e as Error).message}</pre>`;
  }
}

/** Split-preview pane: renders YFM to HTML and hydrates LaTeX formulas via KaTeX. */
function Preview({markup}: {markup: string}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const html = React.useMemo(() => renderHtml(markup), [markup]);
  const runLatex = useLatex();

  React.useEffect(() => {
    loadLatexRuntime();
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('.yfm-latex'));
    if (nodes.length) runLatex({nodes, throwOnError: false});
  }, [html, runLatex]);

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
  /** Exposes a getter for the current markup so the parent can save/export. */
  registerGetValue: (fn: () => string) => void;
  /** Exposes a callback the parent calls after a save to reset the clean baseline. */
  registerMarkSaved: (fn: () => void) => void;
};

export function EditorPane({
  markup,
  mode,
  onDirtyChange,
  onSubmit,
  registerGetValue,
  registerMarkSaved,
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
      extensions: (builder) =>
        builder.use(LatexExtension, {
          loadRuntimeScript: loadLatexRuntime,
          katexOptions: {throwOnError: false},
        }),
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
