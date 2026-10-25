import {beforeEach, describe, expect, it, vi} from 'vitest';

const {invoke, convertFileSrc} = vi.hoisted(() => ({invoke: vi.fn(), convertFileSrc: vi.fn()}));
vi.mock('@tauri-apps/api/core', () => ({invoke, convertFileSrc}));
import {createImageResolver} from './documentImages';

beforeEach(() => {
  invoke.mockReset();
  convertFileSrc.mockReset().mockImplementation((path: string) => `asset://localhost${path}`);
});

describe('desktop document images', () => {
  it('leaves remote image URLs, queries and embedded images unchanged', async () => {
    const resolve = createImageResolver('/docs/family.md');
    for (const src of ['https://example.com/attachment?id=1', 'http://example.com/a.png', 'data:image/png;base64,AA==']) {
      await expect(resolve(src)).resolves.toBe(src);
    }
    expect(invoke).not.toHaveBeenCalled();
  });

  it('resolves paths against the current Markdown file and uses Tauri asset URLs', async () => {
    invoke.mockResolvedValue({path: '/docs/assets/схема.svg', fragment: 'view'});
    await expect(createImageResolver('/docs/family.md')('./assets/схема.svg#view'))
      .resolves.toBe('asset://localhost/docs/assets/схема.svg#view');
    expect(invoke).toHaveBeenCalledWith('resolve_image', {documentPath: '/docs/family.md', src: './assets/схема.svg#view'});
    await createImageResolver('/other/family.md')('./a.png');
    expect(invoke).toHaveBeenLastCalledWith('resolve_image', {documentPath: '/other/family.md', src: './a.png'});
  });

  it('propagates file errors so the view can show a placeholder', async () => {
    invoke.mockRejectedValue(new Error('Missing image'));
    await expect(createImageResolver(null)('./a.png')).rejects.toThrow('Missing image');
    expect(convertFileSrc).not.toHaveBeenCalled();
  });
});
