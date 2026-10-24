import {beforeEach, describe, expect, it, vi} from 'vitest';
import {loadOutlineOpen, saveOutlineOpen} from './documentViewState';

describe('per-document outline visibility', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to closed and remembers each file independently', () => {
    expect(loadOutlineOpen('/long.md')).toBe(false);
    saveOutlineOpen('/long.md', true);
    expect(loadOutlineOpen('/long.md')).toBe(true);
    expect(loadOutlineOpen('/short.md')).toBe(false);
    saveOutlineOpen('/long.md', false);
    expect(loadOutlineOpen('/long.md')).toBe(false);
  });

  it('survives unavailable storage', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {throw new Error('disabled');});
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('disabled');});
    try {
      expect(loadOutlineOpen('/file.md')).toBe(false);
      expect(() => saveOutlineOpen('/file.md', true)).not.toThrow();
    } finally {
      read.mockRestore();
      write.mockRestore();
    }
  });
});
