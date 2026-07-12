import {beforeEach, describe, expect, it} from 'vitest';
import {
  buildRecentFileMenuItems,
  loadRecentFiles,
  RECENT_FILES_LIMIT,
  rememberRecentFile,
  saveRecentFiles,
} from './recentFiles';

describe('recent files', () => {
  beforeEach(() => localStorage.clear());

  it('moves an existing path to the front without duplicating it', () => {
    expect(rememberRecentFile(['/a.md', '/b.md'], '/b.md')).toEqual(['/b.md', '/a.md']);
  });

  it('keeps only the configured number of recent paths', () => {
    const paths = Array.from({length: RECENT_FILES_LIMIT + 3}, (_, i) => `/${i}.md`);
    const result = rememberRecentFile(paths, '/new.md');
    expect(result).toHaveLength(RECENT_FILES_LIMIT);
    expect(result[0]).toBe('/new.md');
  });

  it('persists at most the configured limit', () => {
    const paths = Array.from({length: RECENT_FILES_LIMIT + 2}, (_, i) => `/${i}.md`);
    saveRecentFiles(paths);
    expect(loadRecentFiles()).toEqual(paths.slice(0, RECENT_FILES_LIMIT));
  });

  it('recovers from malformed storage and filters non-string values', () => {
    localStorage.setItem('yfm-editor.recentFiles', '{broken');
    expect(loadRecentFiles()).toEqual([]);
    localStorage.setItem('yfm-editor.recentFiles', JSON.stringify(['/ok.md', 42, null]));
    expect(loadRecentFiles()).toEqual(['/ok.md']);
  });

  it('builds numbered labels and normalizes Windows separators', () => {
    const items = buildRecentFileMenuItems(['C:\\docs\\guide.md']);
    expect(items).toEqual([{label: '1. guide.md — C:/docs'}]);
  });

  it('compacts macOS home paths and distinguishes equal basenames', () => {
    const items = buildRecentFileMenuItems([
      '/Users/alex/work/a/readme.md',
      '/Users/alex/work/b/readme.md',
    ]);
    expect(items[0].label).toBe('1. readme.md — ~/work/a');
    expect(items[1].label).toBe('2. readme.md — ~/work/b');
  });

  it('keeps very long labels within the menu limit', () => {
    const path = `/Users/alex/${'very-long-directory/'.repeat(8)}document.md`;
    const [{label}] = buildRecentFileMenuItems([path]);
    expect(label.length).toBeLessThanOrEqual(91); // 88 chars plus the "1. " prefix
    expect(label).toContain('…');
  });
});
