import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {ThemeProvider, Toaster, ToasterProvider} from '@gravity-ui/uikit';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {EditorPane} from './EditorPane';
import type {ImageSourceResolver} from './documentImages';

beforeEach(() => {
  const createRange = document.createRange.bind(document);
  vi.spyOn(document, 'createRange').mockImplementation(() => Object.assign(createRange(), {
    getClientRects: () => [],
    getBoundingClientRect: () => new DOMRect(),
  }));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const markup = '# Title\n\n![Protected](https://example.invalid/image.png "Diagram" =800x)\n\n' +
  '[![Linked](https://example.invalid/second.png =400x300)](https://example.com)\n';
const outlineLabels = {
  title: 'Outline', show: 'Show', hide: 'Hide', empty: 'Empty', untitled: 'Untitled',
  expand: 'Expand', collapse: 'Collapse', unavailable: 'Unavailable',
};

function openDocument(outlineOpen: boolean, options: {markup?: string; resolveImageSrc?: ImageSourceResolver} = {}) {
  const onDirtyChange = vi.fn();
  let getValue = () => '';
  let replaceContent = (_value: string) => {};
  const element = (resolveImageSrc = options.resolveImageSrc) => (
    <ThemeProvider>
      <ToasterProvider toaster={new Toaster()}>
        <EditorPane
          markup={options.markup ?? markup}
          resolveImageSrc={resolveImageSrc}
          mode="wysiwyg"
          spellcheck
          outlineOpen={outlineOpen}
          onOutlineOpenChange={() => {}}
          outlineLabels={outlineLabels}
          onDirtyChange={onDirtyChange}
          onSubmit={() => {}}
          registerGetValue={(fn) => {getValue = fn;}}
          registerMarkSaved={() => {}}
          registerReplaceContent={(fn) => {replaceContent = fn;}}
          registerCopyAgentContext={() => {}}
        />
      </ToasterProvider>
    </ThemeProvider>
  );
  const view = render(element());
  return {onDirtyChange, getValue: () => getValue(), replaceContent: (value: string) => replaceContent(value),
    changeResolver: (resolve: ImageSourceResolver) => view.rerender(element(resolve))};
}

async function failImages() {
  await waitFor(() => expect(document.querySelectorAll('.ProseMirror [data-qa="g-md-image"] img')).toHaveLength(2));
  const images = Array.from(document.querySelectorAll('.ProseMirror [data-qa="g-md-image"] img'));
  expect(images).toHaveLength(2);
  images.forEach((image) => fireEvent.error(image));
  return images;
}

describe('unavailable document images', () => {
  it.each([true, false])('preserves image markup and stays clean with outline open=%s', async (outlineOpen) => {
    const editor = openDocument(outlineOpen);
    expect(editor.getValue()).toBe(markup.trimEnd());
    const images = await failImages();
    // Repeated load failures must also be harmless.
    images.forEach((image) => fireEvent.error(image));
    expect(editor.getValue()).toBe(markup.trimEnd());
    expect(Array.from(document.querySelectorAll('.ProseMirror [data-qa="g-md-image"] img'))).toEqual(images);
    expect(editor.onDirtyChange.mock.calls).not.toContainEqual([true]);
    expect(screen.getAllByText(/Image unavailable:/)).toHaveLength(2);
  });

  it('still marks real edits dirty and clears the flag after undo', async () => {
    const editor = openDocument(true);
    await failImages();
    const heading = document.querySelector('.ProseMirror h1')!;
    heading.textContent = 'Changed title';
    fireEvent.input(heading);
    await waitFor(() => expect(editor.onDirtyChange).toHaveBeenLastCalledWith(true));
    expect(editor.getValue()).toContain('# Changed title');
    fireEvent.keyDown(document.querySelector('.ProseMirror')!, {key: 'z', code: 'KeyZ', ctrlKey: true});
    await waitFor(() => expect(editor.onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(editor.getValue()).toBe(markup.trimEnd());
  });

  it('keeps reloaded images intact and clean when they fail to load', async () => {
    const editor = openDocument(true);
    const reloaded = markup.replace('Title', 'Reloaded').replace('800x', '640x');
    act(() => editor.replaceContent(reloaded));
    await failImages();
    expect(editor.getValue()).toBe(reloaded.trimEnd());
    expect(editor.onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(editor.onDirtyChange.mock.calls).not.toContainEqual([true]);
  });

  it('loads local images without serializing the resolved URL or losing YFM dimensions', async () => {
    const path = `./assets/${encodeURIComponent('схема 1.svg')}`;
    const source = `![Схема](${path} "Caption" =640x320)`;
    const resolve = vi.fn().mockResolvedValue('asset://localhost/docs/assets/схема%201.svg');
    const editor = openDocument(false, {markup: source, resolveImageSrc: resolve});
    // No request to the app's origin while the platform resolves the path.
    expect(document.querySelector('.ProseMirror [data-qa="g-md-image"] img')).toBeNull();
    await waitFor(() => expect(document.querySelector('.ProseMirror [data-qa="g-md-image"] img')?.getAttribute('src'))
      .toBe('asset://localhost/docs/assets/схема%201.svg'));
    expect(resolve).toHaveBeenCalledWith(path);
    expect(editor.getValue()).toBe(source);
    expect(editor.onDirtyChange.mock.calls).not.toContainEqual([true]);
    fireEvent.error(document.querySelector('.ProseMirror [data-qa="g-md-image"] img')!);
    expect(screen.getByText('Image unavailable: Схема')).toBeTruthy();
    expect(editor.getValue()).toBe(source);
  });

  it('shows a placeholder for missing local files and can retry without editing the document', async () => {
    const source = '![Missing](./missing.png =400x)';
    const resolve = vi.fn().mockRejectedValueOnce(new Error('Missing')).mockResolvedValue('asset://localhost/found.png');
    const editor = openDocument(false, {markup: source, resolveImageSrc: resolve});
    await screen.findByText('Image unavailable: Missing');
    expect(screen.getByText('./missing.png')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(document.querySelector('.ProseMirror [data-qa="g-md-image"] img')?.getAttribute('src')).toBe('asset://localhost/found.png'));
    expect(screen.queryByText('Image unavailable: Missing')).toBeNull();
    expect(editor.getValue()).toBe(source);
    expect(editor.onDirtyChange.mock.calls).not.toContainEqual([true]);
  });

  it('uses the new document location and ignores a late resolution from the old location', async () => {
    let finishOld!: (url: string) => void;
    const oldResolver = () => new Promise<string>((resolve) => {finishOld = resolve;});
    const editor = openDocument(false, {markup: '![Local](./a.png)', resolveImageSrc: oldResolver});
    await waitFor(() => expect(finishOld).toBeDefined());
    editor.changeResolver(() => 'asset://localhost/new/a.png');
    await waitFor(() => expect(document.querySelector('.ProseMirror [data-qa="g-md-image"] img')?.getAttribute('src')).toBe('asset://localhost/new/a.png'));
    await act(async () => finishOld('asset://localhost/old/a.png'));
    expect(document.querySelector('.ProseMirror [data-qa="g-md-image"] img')?.getAttribute('src')).toBe('asset://localhost/new/a.png');
    expect(editor.getValue()).toBe('![Local](./a.png)');
    expect(editor.onDirtyChange.mock.calls).not.toContainEqual([true]);
  });
});
