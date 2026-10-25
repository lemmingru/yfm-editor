import React from 'react';
import {createPortal} from 'react-dom';
import type {ExtensionAuto} from '@gravity-ui/markdown-editor';
import {reactNodeViewFactory, type ReactNodeViewProps} from '@gravity-ui/markdown-editor/_/react-utils/index.js';
import {ImageNodeView, cnImgSizeNodeView} from '@gravity-ui/markdown-editor/extensions/yfm/ImgSize/plugins/ImgSizeNodeView/NodeView.js';

export type ImageSourceResolver = (src: string) => string | Promise<string>;
export type ImageLabels = {unavailable: string; retry: string};

export const defaultImageLabels: ImageLabels = {unavailable: 'Image unavailable', retry: 'Retry'};

/** Local paths need a platform shell; never resolve them against the app's URL. */
export function isRemoteImage(src: string): boolean {
  return /^(https?:|data:image\/|blob:)/i.test(src);
}

export const defaultImageResolver: ImageSourceResolver = (src) => {
  if (isRemoteImage(src)) return src;
  throw new Error('No document image resolver');
};

export const DocumentImagesContext = React.createContext<{
  resolve: ImageSourceResolver;
  labels: ImageLabels;
}>({resolve: defaultImageResolver, labels: defaultImageLabels});

function useImageSource(src: string) {
  const {resolve, labels} = React.useContext(DocumentImagesContext);
  const [attempt, retry] = React.useReducer((n: number) => n + 1, 0);
  const [result, setResult] = React.useState<{
    src: string; resolve: ImageSourceResolver; attempt: number; url?: string; failed?: boolean;
  }>();

  React.useEffect(() => {
    let active = true;
    // Also catch synchronous resolver errors (e.g. an unsaved document).
    Promise.resolve().then(() => resolve(src)).then(
      (url) => {if (active) setResult({src, resolve, attempt, url, failed: !url});},
      () => {if (active) setResult({src, resolve, attempt, failed: true});},
    );
    return () => {active = false;};
  }, [src, resolve, attempt]);

  const current = result?.src === src && result.resolve === resolve && result.attempt === attempt
    ? result : undefined;
  const fail = () => setResult((previous) => previous?.src === src && previous.resolve === resolve
    && previous.attempt === attempt ? {...previous, failed: true} : previous);
  return {url: current?.url, failed: current?.failed, fail, retry, attempt, labels};
}

function ImagePlaceholder({src, alt, labels, retry}: {
  src: string; alt: string; labels: ImageLabels; retry: () => void;
}) {
  return (
    <span className="document-image-placeholder" role="group" aria-label={`${labels.unavailable}: ${alt || src}`}>
      <span>{labels.unavailable}{alt ? `: ${alt}` : ''}</span>
      <span className="document-image-placeholder__source" title={src}>{src}</span>
      <button type="button" onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        retry();
      }}>{labels.retry}</button>
    </span>
  );
}

/** Keep upstream editing/resizing controls, but all loading state stays in React. */
function DocumentImageNodeView(props: ReactNodeViewProps) {
  const src = String(props.node.attrs.src || '');
  const alt = String(props.node.attrs.alt || '');
  const image = useImageSource(src);
  return (
    <span className={`document-image${image.failed ? ' document-image--failed' : ''}`}
      onErrorCapture={(event) => {
        // The upstream error handler replaces the image node with Markdown text.
        event.stopPropagation();
        image.fail();
      }}>
      {image.url && <ImageNodeView {...props} key={image.attempt}
        extensionOptions={{resolveImageSrc: () => image.url!}} />}
      {image.failed && <ImagePlaceholder src={src} alt={alt} labels={image.labels} retry={image.retry} />}
    </span>
  );
}

export const DocumentImages: ExtensionAuto = (builder) => {
  builder.addNodeView('image', reactNodeViewFactory(DocumentImageNodeView, {
    isInline: true,
    reactNodeWrapperCn: cnImgSizeNodeView('wrapper'),
  }));
};

type PreviewImageData = {
  src: string; alt: string; title: string; width: string | null; height: string | null;
  className: string; style: React.CSSProperties;
};

function PreviewImage({src, alt, title, width, height, className, style}: PreviewImageData) {
  const image = useImageSource(src);
  return (
    <span className={`document-image${image.failed ? ' document-image--failed' : ''}`}>
      {image.url && <img key={image.attempt} src={image.url} alt={alt} title={title || undefined}
        className={className || undefined} style={style}
        width={width || undefined} height={height || undefined} onError={image.fail} />}
      {image.failed && <ImagePlaceholder src={src} alt={alt} labels={image.labels} retry={image.retry} />}
    </span>
  );
}

/** Inert hosts prevent the browser from requesting unresolved relative paths. */
export function preparePreviewImages(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const images: PreviewImageData[] = [];
  template.content.querySelectorAll('img').forEach((img) => {
    const style = Object.fromEntries(Array.from(img.style, (property) => [
      property.startsWith('--') ? property : property.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase()),
      img.style.getPropertyValue(property),
    ])) as React.CSSProperties;
    images.push({src: img.getAttribute('src') || '', alt: img.alt, title: img.title,
      width: img.getAttribute('width'), height: img.getAttribute('height'), className: img.className, style});
    const host = document.createElement('span');
    host.setAttribute('data-document-image', String(images.length - 1));
    img.replaceWith(host);
  });
  return {html: template.innerHTML, images};
}

export function PreviewImages({root, images}: {root: HTMLElement | null; images: PreviewImageData[]}) {
  const [hosts, setHosts] = React.useState<HTMLElement[]>([]);
  React.useLayoutEffect(() => {
    setHosts(root ? Array.from(root.querySelectorAll<HTMLElement>('[data-document-image]')) : []);
  }, [root, images]);
  return <>{hosts.map((host) => {
    const index = Number(host.dataset.documentImage);
    return images[index] ? createPortal(<PreviewImage {...images[index]} />, host, String(index)) : null;
  })}</>;
}
