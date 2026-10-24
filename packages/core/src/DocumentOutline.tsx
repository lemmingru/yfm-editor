import React from 'react';
import {Button} from '@gravity-ui/uikit';
import type {MarkdownEditorInstance, Parser} from '@gravity-ui/markdown-editor';
import {EditorView as CodeMirrorView} from '@codemirror/view';
import type {EditorView as VisualView} from '@gravity-ui/markdown-editor/pm/view';
import {
  buildOutlineTree,
  collectHeadings,
  headingScrollContainer,
  navigateVisualHeading,
  previewHeadingText,
  revealHeading,
  scrollHeadingIntoView,
  type OutlineBranch,
  type OutlineHeading,
} from './outlineModel';

export type OutlineLabels = {
  title: string;
  show: string;
  hide: string;
  empty: string;
  untitled: string;
  expand: string;
  collapse: string;
  unavailable: string;
};

const defaultLabels: OutlineLabels = {
  title: 'Document outline',
  show: 'Show document outline',
  hide: 'Hide document outline',
  empty: 'There are no headings yet. Add headings to navigate between sections.',
  untitled: 'Untitled heading',
  expand: 'Expand section',
  collapse: 'Collapse section',
  unavailable: 'The outline will appear when the Markdown structure is complete.',
};

export const OutlineContext = React.createContext({
  open: false,
  toggle: () => {},
  labels: defaultLabels,
  panelId: '',
});

export function OutlineToggle() {
  const {open, toggle, labels, panelId} = React.useContext(OutlineContext);
  return (
    <Button
      size="s"
      view="flat"
      selected={open}
      className="document-outline-toggle"
      title={open ? labels.hide : labels.show}
      aria-label={open ? labels.hide : labels.show}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={toggle}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 3v10M3.5 5.5h.5m-.5 2.5h.5m-.5 2.5h.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </Button>
  );
}

// The bundle exposes only a small public interface. Keep its mode-specific
// handles in one adapter; never use source-line attributes from edited visual nodes.
type OutlineEditor = MarkdownEditorInstance & {
  cm: CodeMirrorView;
  _wysiwygView?: VisualView;
  wysiwygEditor: {parser: Parser};
};

export function DocumentOutline({
  editor,
  editorRoot,
}: {
  editor: MarkdownEditorInstance;
  editorRoot: React.RefObject<HTMLDivElement>;
}) {
  const {open, toggle, labels, panelId} = React.useContext(OutlineContext);
  const [headings, setHeadings] = React.useState<OutlineHeading[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [collapsed, setCollapsed] = React.useState<Set<number>>(() => new Set());
  const [parseFailed, setParseFailed] = React.useState(false);
  // A short final section cannot always be aligned with the viewport top.
  // Keep the explicit destination selected until the user moves in the editor.
  const destinationRef = React.useRef<number | null>(null);
  const bundle = editor as OutlineEditor;
  const tree = React.useMemo(() => buildOutlineTree(headings), [headings]);
  const hierarchy = headings.map(({level}) => level).join(',');

  React.useEffect(() => setCollapsed(new Set()), [hierarchy]);

  React.useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      try {
        const doc = editor.currentMode === 'wysiwyg'
          ? bundle._wysiwygView?.state.doc
          : bundle.wysiwygEditor.parser.parse(editor.getValue());
        setHeadings(doc ? collectHeadings(doc) : []);
        setParseFailed(false);
      } catch {
        // Incomplete YFM during typing must not break the editable document or
        // leave stale source positions available for navigation.
        setHeadings([]);
        setParseFailed(true);
      }
    };
    const onChange = () => {
      destinationRef.current = null;
      clearTimeout(timer);
      timer = setTimeout(refresh, 100);
    };
    const onModeChange = () => {
      setHeadings([]);
      setCollapsed(new Set());
      onChange();
    };
    refresh();
    editor.on('change', onChange);
    editor.on('change-editor-mode', onModeChange);
    return () => {
      clearTimeout(timer);
      editor.off('change', onChange);
      editor.off('change-editor-mode', onModeChange);
    };
  }, [open, editor, bundle]);

  React.useEffect(() => {
    const root = editorRoot.current;
    if (!open || !root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (destinationRef.current !== null) {
        setActiveIndex(destinationRef.current);
        return;
      }
      const toolbar = root.querySelector<HTMLElement>('[data-layout="sticky-toolbar"]');
      const visualDom = bundle._wysiwygView?.dom;
      const scroller = editor.currentMode === 'markup'
        ? bundle.cm.scrollDOM
        : visualDom ? headingScrollContainer(visualDom, root) : root;
      const top = Math.max(scroller.getBoundingClientRect().top,
        toolbar?.getBoundingClientRect().bottom ?? root.getBoundingClientRect().top) + 12;
      const atEnd = scroller.scrollHeight > scroller.clientHeight + 1 &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      const threshold = atEnd ? scroller.getBoundingClientRect().bottom : top;
      let current = -1;
      for (let index = 0; index < headings.length; index++) {
        const heading = headings[index];
        let headingTop: number;
        if (editor.currentMode === 'markup') {
          if (heading.line === null || heading.line >= bundle.cm.state.doc.lines) continue;
          const pos = bundle.cm.state.doc.line(heading.line + 1).from;
          headingTop = bundle.cm.documentTop + bundle.cm.lineBlockAt(pos).top;
        } else {
          const node = bundle._wysiwygView?.nodeDOM(heading.pos);
          if (!(node instanceof HTMLElement) || !node.getClientRects().length) continue;
          headingTop = node.getBoundingClientRect().top;
        }
        if (current === -1 || headingTop <= threshold) current = index;
        if (headingTop > threshold) break;
      }
      setActiveIndex(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const followScroll = () => {
      destinationRef.current = null;
      schedule();
    };
    root.addEventListener('scroll', schedule, true);
    const interactions = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    interactions.forEach((event) => root.addEventListener(event, followScroll, {passive: true}));
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener('scroll', schedule, true);
      interactions.forEach((event) => root.removeEventListener(event, followScroll));
    };
  }, [headings, open, editor, bundle, editorRoot]);

  const navigate = (index: number) => {
    if (editor.previewVisible) {
      editor.changePreviewVisible(false);
      requestAnimationFrame(() => navigate(index));
      return;
    }
    const root = editorRoot.current;
    if (!root) return;
    // Re-read positions at action time, including edits made during the debounce.
    let doc;
    try {
      doc = editor.currentMode === 'wysiwyg'
        ? bundle._wysiwygView?.state.doc
        : bundle.wysiwygEditor.parser.parse(editor.getValue());
    } catch {
      setHeadings([]);
      setParseFailed(true);
      return;
    }
    const current = doc ? collectHeadings(doc) : [];
    const heading = current[index];
    setHeadings(current);
    if (!heading || current.length !== headings.length ||
      heading.title !== headings[index]?.title) return;
    if (editor.currentMode === 'markup' && heading.line !== null) {
      const cm = bundle.cm;
      const anchor = cm.state.doc.line(heading.line + 1).from;
      cm.dispatch({
        selection: {anchor},
        effects: CodeMirrorView.scrollIntoView(anchor, {y: 'start', yMargin: 52}),
      });
      cm.focus();
      const preview = root.querySelector<HTMLElement>('.preview');
      const previewHeading = preview?.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')[index];
      if (preview && previewHeading && previewHeadingText(previewHeading) === heading.title.trim()) {
        revealHeading(previewHeading, preview);
        scrollHeadingIntoView(previewHeading, root);
      }
    } else if (bundle._wysiwygView) {
      navigateVisualHeading(bundle._wysiwygView, heading, root);
    }
    destinationRef.current = index;
    setActiveIndex(index);
    if (window.matchMedia('(max-width: 800px)').matches) toggle();
  };

  const close = () => {
    toggle();
    editorRoot.current?.querySelector<HTMLButtonElement>('.document-outline-toggle')?.focus();
  };

  const renderBranches = (branches: OutlineBranch[]): React.ReactNode => (
    <ul className="document-outline__list">
      {branches.map((branch) => {
        const folded = collapsed.has(branch.index);
        const title = branch.title || labels.untitled;
        return (
          <li key={branch.index}>
            <div className="document-outline__row">
              {branch.children.length ? (
                <button
                  type="button"
                  className="document-outline__fold"
                  aria-label={`${folded ? labels.expand : labels.collapse}: ${title}`}
                  aria-expanded={!folded}
                  onClick={() => setCollapsed((previous) => {
                    const next = new Set(previous);
                    if (folded) next.delete(branch.index);
                    else next.add(branch.index);
                    return next;
                  })}
                >
                  <span aria-hidden="true">{folded ? '›' : '⌄'}</span>
                </button>
              ) : <span className="document-outline__fold-spacer" />}
              <button
                type="button"
                className="document-outline__heading"
                aria-current={branch.index === activeIndex ? 'location' : undefined}
                title={title}
                onClick={() => navigate(branch.index)}
              >
                {title}
              </button>
            </div>
            {!folded && branch.children.length ? renderBranches(branch.children) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav id={panelId} className="document-outline" aria-label={labels.title} hidden={!open}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          close();
        }
      }}>
      <div className="document-outline__header">
        <strong>{labels.title}</strong>
        <Button size="s" view="flat" title={labels.hide} aria-label={labels.hide} onClick={close}>×</Button>
      </div>
      <div className="document-outline__contents">
        {headings.length ? renderBranches(tree) : (
          <p className="document-outline__empty" role="status">{parseFailed ? labels.unavailable : labels.empty}</p>
        )}
      </div>
    </nav>
  );
}
