import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // The editor schema touches DOM APIs while building node specs.
    environment: 'jsdom',
  },
});
