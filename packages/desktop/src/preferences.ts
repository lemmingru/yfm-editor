// User preferences, persisted in localStorage (stable per-app in WKWebView).

import type {EditorMode} from '@yfm-editor/core';

export type {EditorMode};
/** @deprecated Kept as an alias; documents always open in an editable mode now. */
export type EditingMode = EditorMode;
export type ThemePref = 'light' | 'dark' | 'system';
export type LanguagePref = 'en' | 'ru' | 'system';
export type OpenBehaviorPref = 'newWindow' | 'sameWindow';

export type Preferences = {
  theme: ThemePref;
  language: LanguagePref;
  defaultMode: EditorMode;
  openBehavior: OpenBehaviorPref;
  spellcheck: boolean;
};

const STORAGE_KEY = 'yfm-editor.preferences';

const DEFAULTS: Preferences = {
  theme: 'system',
  language: 'system',
  // Documents open ready to edit; preview is a toggle in the editor toolbar.
  defaultMode: 'wysiwyg',
  // macOS-native default: each opened document gets its own window.
  openBehavior: 'newWindow',
  // Native webview spell checking, on by default.
  spellcheck: true,
};

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {...DEFAULTS};
    const stored = JSON.parse(raw) as Partial<Preferences>;
    const merged = {...DEFAULTS, ...stored};
    // Migrate the retired read-only 'view' default to an editable mode.
    if (merged.defaultMode !== 'markup' && merged.defaultMode !== 'wysiwyg') {
      merged.defaultMode = DEFAULTS.defaultMode;
    }
    if (merged.language !== 'en' && merged.language !== 'ru' && merged.language !== 'system') {
      merged.language = DEFAULTS.language;
    }
    if (merged.openBehavior !== 'newWindow' && merged.openBehavior !== 'sameWindow') {
      merged.openBehavior = DEFAULTS.openBehavior;
    }
    if (typeof merged.spellcheck !== 'boolean') {
      merged.spellcheck = DEFAULTS.spellcheck;
    }
    return merged;
  } catch {
    return {...DEFAULTS};
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** Resolve a theme preference to a concrete light/dark value. */
export function resolveTheme(theme: ThemePref): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}
