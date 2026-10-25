import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Preview} from './EditorPane';
import {DocumentImagesContext, defaultImageLabels, defaultImageResolver, preparePreviewImages} from './documentImages';

afterEach(cleanup);

describe('document image preview', () => {
  it('does not put unresolved image sources into preview HTML', () => {
    const prepared = preparePreviewImages('<p>Before<img src="./assets/a.png" width="800" title="Diagram">After</p>');
    expect(prepared.html).not.toContain('<img');
    expect(prepared.html).toContain('Before<span data-document-image="0"></span>After');
    expect(prepared.images[0]).toMatchObject({src: './assets/a.png', width: '800', title: 'Diagram'});
  });

  it('renders local and URL images with dimensions and replaces failed loads with localized placeholders', async () => {
    const resolve = vi.fn((src: string) => src.startsWith('./') ? 'asset://localhost/docs/a.png' : src);
    const view = render(<DocumentImagesContext.Provider value={{resolve, labels: {
      unavailable: 'Изображение недоступно', retry: 'Повторить загрузку',
    }}}>
      <Preview markup={'![Local](./a.png "Diagram" =800x)\n\n[![Remote](https://example.com/a.png =400x300)](https://example.com)'} />
    </DocumentImagesContext.Provider>);
    await waitFor(() => expect(view.container.querySelectorAll('img')).toHaveLength(2));
    const local = view.container.querySelector('img[alt="Local"]')!;
    const remote = view.container.querySelector('img[alt="Remote"]')!;
    expect(local.getAttribute('src')).toBe('asset://localhost/docs/a.png');
    expect(local.getAttribute('width')).toBe('800');
    expect(local.getAttribute('title')).toBe('Diagram');
    expect(remote.getAttribute('src')).toBe('https://example.com/a.png');
    expect(remote.getAttribute('height')).toBe('300');
    fireEvent.error(remote);
    expect(screen.getByText('Изображение недоступно: Remote')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Повторить загрузку'}));
    await waitFor(() => expect(view.container.querySelector('img[alt="Remote"]')).not.toBe(remote));
    expect(screen.queryByText('Изображение недоступно: Remote')).toBeNull();
  });

  it('updates image hosts when markup changes, and handles relative images in an unsaved document', async () => {
    const view = render(<Preview markup="![Before](https://example.com/before.png)" />);
    await screen.findByAltText('Before');
    view.rerender(<Preview markup="![After](./after.png =640x)" />);
    await screen.findByText('Image unavailable: After');
    expect(screen.queryByAltText('Before')).toBeNull();
    expect(view.container.querySelector('img[src="./after.png"]')).toBeNull();
  });

  it('retains embedded images but rejects paths without a platform resolver', () => {
    expect(defaultImageResolver('data:image/png;base64,AA==')).toBe('data:image/png;base64,AA==');
    expect(() => defaultImageResolver('./a.png')).toThrow();
    expect(() => defaultImageResolver('javascript:alert(1)')).toThrow();
    expect(defaultImageLabels.unavailable).toBe('Image unavailable');
  });
});
