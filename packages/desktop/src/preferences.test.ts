import {beforeEach, describe, expect, it, vi} from 'vitest';
import {loadPreferences, resolveTheme, savePreferences} from './preferences';

const key = 'yfm-editor.preferences';

describe('preferences', () => {
  beforeEach(() => localStorage.clear());

  it('returns defaults when storage is empty or malformed', () => {
    expect(loadPreferences()).toEqual({
      theme: 'system',
      language: 'system',
      defaultMode: 'wysiwyg',
      openBehavior: 'newWindow',
    });
    localStorage.setItem(key, '{broken');
    expect(loadPreferences().defaultMode).toBe('wysiwyg');
  });

  it('merges partial preferences with defaults', () => {
    localStorage.setItem(key, JSON.stringify({theme: 'dark'}));
    expect(loadPreferences()).toMatchObject({theme: 'dark', language: 'system'});
  });

  it('migrates retired and unknown enum values to safe defaults', () => {
    localStorage.setItem(
      key,
      JSON.stringify({defaultMode: 'view', language: 'xx', openBehavior: 'tab'}),
    );
    expect(loadPreferences()).toMatchObject({
      defaultMode: 'wysiwyg',
      language: 'system',
      openBehavior: 'newWindow',
    });
  });

  it('saves preferences to storage', () => {
    const prefs = {
      theme: 'light' as const,
      language: 'ru' as const,
      defaultMode: 'markup' as const,
      openBehavior: 'sameWindow' as const,
    };
    savePreferences(prefs);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(prefs);
  });

  it('resolves system and explicit themes', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({matches: true} as MediaQueryList);
    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    expect(() =>
      savePreferences({
        theme: 'system',
        language: 'system',
        defaultMode: 'wysiwyg',
        openBehavior: 'newWindow',
      }),
    ).not.toThrow();
  });
});
