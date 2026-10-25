import {convertFileSrc, invoke} from '@tauri-apps/api/core';
import type {ImageSourceResolver} from '@yfm-editor/core';

export function createImageResolver(documentPath: string | null): ImageSourceResolver {
  return async (src) => {
    if (/^(https?:|data:image\/|blob:)/i.test(src)) return src;
    const image = await invoke<{path: string; fragment: string | null}>('resolve_image', {
      documentPath, src,
    });
    return convertFileSrc(image.path) + (image.fragment ? `#${image.fragment}` : '');
  };
}
