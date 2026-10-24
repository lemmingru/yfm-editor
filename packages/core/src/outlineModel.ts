import type {ExtensionAuto} from '@gravity-ui/markdown-editor';
import type {Node} from '@gravity-ui/markdown-editor/pm/model';
import {TextSelection} from '@gravity-ui/markdown-editor/pm/state';
import type {EditorView} from '@gravity-ui/markdown-editor/pm/view';

/** Source lines are refreshed by parsing Markdown; live visual nodes use positions instead. */
export const OutlineSourceLines: ExtensionAuto = (builder) => {
  builder.overrideMarkdownTokenParserSpec('heading', (previous) => ({
    ...previous,
    getAttrs: (token, tokens, index) => ({
      ...previous.getAttrs?.(token, tokens, index),
      'data-line': token.map?.[0] ?? null,
    }),
  }));
};

export type OutlineHeading = {
  title: string;
  level: number;
  /** Position before the heading in the current ProseMirror document. */
  pos: number;
  /** Zero-based source line; only authoritative immediately after parsing Markdown. */
  line: number | null;
};

export type OutlineBranch = OutlineHeading & {
  index: number;
  children: OutlineBranch[];
};

export function collectHeadings(doc: Node): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return;
    headings.push({
      title: node.textContent,
      level: node.attrs.level,
      pos,
      line: typeof node.attrs['data-line'] === 'number' ? node.attrs['data-line'] : null,
    });
    return false;
  });
  return headings;
}

export function buildOutlineTree(headings: OutlineHeading[]): OutlineBranch[] {
  const roots: OutlineBranch[] = [];
  const ancestors: OutlineBranch[] = [];
  headings.forEach((heading, index) => {
    const branch: OutlineBranch = {...heading, index, children: []};
    while (ancestors.length && ancestors[ancestors.length - 1].level >= heading.level) {
      ancestors.pop();
    }
    (ancestors.length ? ancestors[ancestors.length - 1].children : roots).push(branch);
    ancestors.push(branch);
  });
  return roots;
}

/** Reveal containers from the outside in, using the same controls as the user. */
export function revealHeading(target: HTMLElement, root: HTMLElement): void {
  const ancestors: HTMLElement[] = [];
  for (let parent = target.parentElement; parent && parent !== root; parent = parent.parentElement) {
    ancestors.unshift(parent);
  }
  for (const parent of ancestors) {
    if (parent.classList.contains('yfm-cut') && !parent.classList.contains('yfm-cut-open')) {
      parent.querySelector<HTMLElement>(':scope > .yfm-cut-title')?.click();
    }
    if (parent.classList.contains('yfm-tab-panel')) {
      const tabId = parent.getAttribute('aria-labelledby');
      const tabs = parent.parentElement?.querySelectorAll<HTMLElement>('.yfm-tab') ?? [];
      const tab = Array.from(tabs).find((item) =>
        item.getAttribute('aria-controls') === parent.id ||
        item.getAttribute('data-diplodoc-id') === tabId,
      );
      if (tab && tab.getAttribute('data-diplodoc-is-active') !== 'true') tab.click();
    }
  }
}

export function headingScrollContainer(target: HTMLElement, root: HTMLElement): HTMLElement {
  for (let parent = target.parentElement; parent && parent !== root; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) &&
      parent.scrollHeight > parent.clientHeight) return parent;
  }
  return root;
}

export function previewHeadingText(heading: HTMLElement): string {
  const copy = heading.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.yfm-anchor, [aria-hidden="true"]').forEach((node) => node.remove());
  return copy.textContent?.trim() ?? '';
}

export function scrollHeadingIntoView(target: HTMLElement, root: HTMLElement): void {
  const toolbar = root.querySelector<HTMLElement>('[data-layout="sticky-toolbar"]');
  const scroller = headingScrollContainer(target, root);
  const scrollerTop = scroller.getBoundingClientRect().top;
  const visibleTop = Math.max(scrollerTop, toolbar?.getBoundingClientRect().bottom ?? scrollerTop);
  scroller.scrollTop += target.getBoundingClientRect().top - visibleTop - 12;
}

export function navigateVisualHeading(view: EditorView, heading: OutlineHeading, root: HTMLElement) {
  const $target = view.state.doc.resolve(heading.pos + 1);
  const tr = view.state.tr;
  for (let depth = 0; depth < $target.depth; depth++) {
    const active: {node: Node; pos: number}[] = [];
    const targetIndex = $target.index(depth);
    $target.node(depth).forEach((node, offset, index) => {
      if (index > targetIndex) return;
      if (node.type.name === 'heading') {
        while (active.length && active[active.length - 1].node.attrs.level >= node.attrs.level) {
          active.pop();
        }
        if (index < targetIndex && node.attrs.folded === true) {
          active.push({node, pos: $target.start(depth) + offset});
        }
      }
    });
    active.forEach(({pos}) => tr.setNodeAttribute(pos, 'folded', false));
  }
  // Folding is a view state: both boolean values serialize to the same `#+`.
  // Opening a containing section must not add an undo step for document edits.
  if (tr.docChanged) {
    view.dispatch(tr.setMeta('folding-heading-changed', true).setMeta('addToHistory', false));
  }
  const target = view.nodeDOM(heading.pos);
  if (!(target instanceof HTMLElement)) return;
  revealHeading(target, root);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, heading.pos + 1)));
  view.focus();
  scrollHeadingIntoView(target, root);
}
