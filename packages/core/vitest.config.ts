import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  resolve: {
    // These packages default to CJS in Node. Use their ESM builds so the real
    // editor tests share one ProseMirror plugin registry with the editor.
    alias: Object.fromEntries(['codemark', 'autocomplete'].map((name) => [
      `prosemirror-${name}`,
      fileURLToPath(new URL(`../../node_modules/prosemirror-${name}/dist/esm/index.js`, import.meta.url)),
    ])),
  },
  test: {
    // The editor schema touches DOM APIs while building node specs.
    environment: 'jsdom',
    // Let Vite handle vendor CSS imported by the editor components.
    server: {
      deps: {inline: [/@gravity-ui\//, /@diplodoc\//, /prosemirror-(codemark|autocomplete)/]},
    },
  },
});
