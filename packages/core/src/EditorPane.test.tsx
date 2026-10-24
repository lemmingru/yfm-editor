import {act, cleanup, fireEvent, render, waitFor} from '@testing-library/react';
import {ThemeProvider, Toaster, ToasterProvider} from '@gravity-ui/uikit';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {EditorPane} from './EditorPane';

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

function openDocument(outlineOpen: boolean) {
  const onDirtyChange = vi.fn();
  let getValue = () => '';
  let replaceContent = (_value: string) => {};
  render(
    <ThemeProvider>
      <ToasterProvider toaster={new Toaster()}>
        <EditorPane
          markup={markup}
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
    </ThemeProvider>,
  );
  return {onDirtyChange, getValue: () => getValue(), replaceContent: (value: string) => replaceContent(value)};
}

function failImages() {
  const images = Array.from(document.querySelectorAll('.ProseMirror [data-qa="g-md-image"] img'));
  expect(images).toHaveLength(2);
  images.forEach((image) => fireEvent.error(image));
  return images;
}

describe('unavailable document images', () => {
  it.each([true, false])('preserves image markup and stays clean with outline open=%s', (outlineOpen) => {
    const editor = openDocument(outlineOpen);
    expect(editor.getValue()).toBe(markup.trimEnd());
    const images = failImages();
    // Repeated load failures must also be harmless.
    images.forEach((image) => fireEvent.error(image));
    expect(editor.getValue()).toBe(markup.trimEnd());
    expect(Array.from(document.querySelectorAll('.ProseMirror [data-qa="g-md-image"] img'))).toEqual(images);
    expect(editor.onDirtyChange.mock.calls).not.toContainEqual([true]);
  });

  it('still marks real edits dirty and clears the flag after undo', async () => {
    const editor = openDocument(true);
    failImages();
    const heading = document.querySelector('.ProseMirror h1')!;
    heading.textContent = 'Changed title';
    fireEvent.input(heading);
    await waitFor(() => expect(editor.onDirtyChange).toHaveBeenLastCalledWith(true));
    expect(editor.getValue()).toContain('# Changed title');
    fireEvent.keyDown(document.querySelector('.ProseMirror')!, {key: 'z', code: 'KeyZ', ctrlKey: true});
    await waitFor(() => expect(editor.onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(editor.getValue()).toBe(markup.trimEnd());
  });

  it('keeps reloaded images intact and clean when they fail to load', () => {
    const editor = openDocument(true);
    const reloaded = markup.replace('Title', 'Reloaded').replace('800x', '640x');
    act(() => editor.replaceContent(reloaded));
    failImages();
    expect(editor.getValue()).toBe(reloaded.trimEnd());
    expect(editor.onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(editor.onDirtyChange.mock.calls).not.toContainEqual([true]);
  });
});
