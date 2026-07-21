import React from 'react';
import {
  configure as configureMarkdownEditor,
  Lang as MarkdownEditorLang,
} from '@gravity-ui/markdown-editor';
import {
  configure as configureGravity,
  Lang as GravityLang,
  Button,
  Modal,
  SegmentedRadioGroup,
  Text,
  ThemeProvider,
  Toaster,
  ToasterComponent,
  ToasterProvider,
} from '@gravity-ui/uikit';
import {emit, listen} from '@tauri-apps/api/event';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {homeDir} from '@tauri-apps/api/path';
import {ask, message} from '@tauri-apps/plugin-dialog';
import {EditorPane} from '@yfm-editor/core';
import type {CopyAgentContextResult} from '@yfm-editor/core';
import {
  fetchFile,
  saveFile,
  pickOpenPath,
  pickSavePath,
  frontendReady,
  setDocumentEdited,
  updateRecentFilesMenu,
  setMenuLabels,
  setSpellcheckChecked,
  requestQuit,
  cancelQuit,
  openFileWindow,
  setRepresentedFile,
  watchFile,
  unwatchFile,
} from './api/client';
import {
  loadPreferences,
  savePreferences,
  resolveTheme,
  type EditorMode,
  type LanguagePref,
  type OpenBehaviorPref,
  type Preferences,
  type ThemePref,
} from './preferences';
import {buildMenuLabels, I18nProvider, resolveLang, useI18n} from './i18n';
import {
  buildRecentFileMenuItems,
  loadRecentFiles,
  rememberRecentFile,
  saveRecentFiles,
} from './recentFiles';

const toaster = new Toaster();
let configuredLang: ReturnType<typeof resolveLang> | null = null;

function basename(p: string): string {
  return p.split(/[/\\]/).pop() || p;
}

function dirname(p: string): string {
  const parts = p.split(/[/\\]/);
  parts.pop();
  return parts.join('/') || '/';
}

/** Abbreviate the user's home directory as `~` for a compact status-bar path. */
function prettifyDir(dir: string, home: string): string {
  if (!home) return dir;
  const trimmed = home.replace(/[/\\]$/, '');
  if (dir === trimmed) return '~';
  if (dir.startsWith(`${trimmed}/`)) return `~${dir.slice(trimmed.length)}`;
  return dir;
}

function configureUiLang(lang: ReturnType<typeof resolveLang>) {
  if (configuredLang === lang) return;
  configuredLang = lang;
  configureGravity({lang: lang as GravityLang, fallbackLang: GravityLang.En});
  configureMarkdownEditor({lang: lang as MarkdownEditorLang});
}

function showCopyAgentContextToast(
  content: string,
  theme: 'success' | 'warning' | 'danger',
  autoHiding = 6000,
) {
  const name = 'copy-agent-context';
  toaster.remove(name);
  toaster.add({name, content, theme, autoHiding, isClosable: true});
}

function showFileReloadedToast(content: string) {
  const name = 'file-reloaded';
  toaster.remove(name);
  toaster.add({name, content, theme: 'info', autoHiding: 4000, isClosable: true});
}

async function clearClipboard() {
  await navigator.clipboard.writeText('').catch(() => {});
}

export function App() {
  const [prefs, setPrefs] = React.useState<Preferences>(loadPreferences);
  const [resolvedTheme, setResolvedTheme] = React.useState(() => resolveTheme(prefs.theme));
  const resolvedLang = React.useMemo(() => resolveLang(prefs.language), [prefs.language]);
  configureUiLang(resolvedLang);

  // Re-resolve when the preference changes or (for 'system') the OS scheme flips.
  React.useEffect(() => {
    setResolvedTheme(resolveTheme(prefs.theme));
    if (prefs.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolvedTheme(resolveTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [prefs.theme]);

  const updatePrefs = React.useCallback(
    (patch: Partial<Preferences>) => {
      const next = {...prefs, ...patch};
      savePreferences(next);
      setPrefs(next);
      emit('prefs-updated').catch(() => {});
    },
    [prefs],
  );

  React.useEffect(() => {
    const unlisten = listen('prefs-updated', () => setPrefs(loadPreferences()));
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = resolvedLang;
  }, [resolvedLang]);

  return (
    <ThemeProvider theme={resolvedTheme}>
      <I18nProvider lang={resolvedLang}>
        <ToasterProvider toaster={toaster}>
          <Workspace
            prefs={prefs}
            resolvedTheme={resolvedTheme}
            resolvedLang={resolvedLang}
            onUpdatePrefs={updatePrefs}
          />
          <ToasterComponent />
        </ToasterProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

function Workspace({
  prefs,
  resolvedTheme,
  resolvedLang,
  onUpdatePrefs,
}: {
  prefs: Preferences;
  resolvedTheme: 'light' | 'dark';
  resolvedLang: ReturnType<typeof resolveLang>;
  onUpdatePrefs: (patch: Partial<Preferences>) => void;
}) {
  const {t} = useI18n();
  const [filePath, setFilePath] = React.useState<string | null>(null);
  const [markup, setMarkup] = React.useState<string>('');
  const [dirty, setDirty] = React.useState(false);
  const [docKey, setDocKey] = React.useState(0);
  const [activeMode, setActiveMode] = React.useState<EditorMode>(prefs.defaultMode);
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [recentFiles, setRecentFiles] = React.useState<string[]>(loadRecentFiles);
  const [home, setHome] = React.useState('');
  // The file on disk changed since we last read/wrote it, and the user hasn't
  // decided yet. Drives the reload banner and the save-overwrite confirmation.
  const [externalChangePending, setExternalChangePending] = React.useState(false);
  // The user chose "Keep Mine" on the banner; hide it until the next change.
  const [bannerDismissed, setBannerDismissed] = React.useState(false);

  React.useEffect(() => {
    homeDir()
      .then((dir) => setHome(dir))
      .catch(() => {});
  }, []);

  // Getter for the editor's current markup (set by EditorPane).
  const getValueRef = React.useRef<() => string>(() => '');
  // Resets the editor's clean baseline after a successful save (set by EditorPane).
  const markSavedRef = React.useRef<() => void>(() => {});
  // Replaces the editor contents in place, preserving scroll (set by EditorPane).
  const replaceContentRef = React.useRef<(markup: string) => void>(() => {});
  // Copies current selection/current line with file location for agent prompts.
  const copyAgentContextRef = React.useRef<(filePath: string) => Promise<CopyAgentContextResult>>(
    async () => ({status: 'no-context'}),
  );
  // Latest dirty flag for use inside one-shot listeners.
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;
  const recentFilesRef = React.useRef(recentFiles);
  recentFilesRef.current = recentFiles;
  const tRef = React.useRef(t);
  tRef.current = t;

  const confirmDiscard = React.useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) return true;
    return ask(t('unsavedDiscardQuestion'), {
      title: t('unsavedChangesTitle'),
      kind: 'warning',
    });
  }, [t]);

  const rememberPath = React.useCallback((path: string) => {
    setRecentFiles((prev) => {
      const next = rememberRecentFile(prev, path);
      saveRecentFiles(next);
      return next;
    });
  }, []);

  const loadPath = React.useCallback(
    (path: string) => {
      return fetchFile(path)
        .then((res) => {
          setMarkup(res.content);
          setFilePath(path);
          setDirty(false);
          setActiveMode(prefs.defaultMode);
          setDocKey((k) => k + 1);
          rememberPath(path);
        })
        .catch((e) => message(e.message, {title: t('openFailed'), kind: 'error'}));
    },
    [prefs.defaultMode, rememberPath, t],
  );

  // Re-read the open file from disk, replacing the editor contents in place
  // (no remount) so the user's scroll position and reading context are kept.
  // Preserves the current editing mode and clears the external-change banner.
  const reloadFromDisk = React.useCallback(
    (): Promise<void> => {
      if (!filePath) return Promise.resolve();
      return fetchFile(filePath)
        .then((res) => {
          replaceContentRef.current(res.content);
          setMarkup(res.content);
          setExternalChangePending(false);
          setBannerDismissed(false);
        })
        .catch((e) => {
          message(e.message, {title: t('openFailed'), kind: 'error'});
        });
    },
    [filePath, t],
  );
  const reloadFromDiskRef = React.useRef(reloadFromDisk);
  reloadFromDiskRef.current = reloadFromDisk;

  const canReuseCurrentWindow = filePath === null && !dirty;

  const openPathByPreference = React.useCallback(
    async (path: string) => {
      if (prefs.openBehavior === 'newWindow' && !canReuseCurrentWindow) {
        return openFileWindow(path).catch((e) =>
          message(e.message, {title: t('openFailed'), kind: 'error'}),
        );
      }
      if (await confirmDiscard()) void loadPath(path);
    },
    [canReuseCurrentWindow, confirmDiscard, loadPath, prefs.openBehavior, t],
  );

  const openFromOs = React.useCallback(
    async (path: string) => {
      await openPathByPreference(path);
    },
    [openPathByPreference],
  );

  const handleOpen = React.useCallback(async () => {
    const path = await pickOpenPath();
    if (path) await openPathByPreference(path);
  }, [openPathByPreference]);

  const handleNew = React.useCallback(async () => {
    if (prefs.openBehavior === 'newWindow' && !canReuseCurrentWindow) {
      await openFileWindow().catch((e) =>
        message(e.message, {title: t('openFailed'), kind: 'error'}),
      );
      return;
    }
    if (!(await confirmDiscard())) return;
    setMarkup('');
    setFilePath(null);
    setDirty(false);
    setActiveMode(prefs.defaultMode);
    setDocKey((k) => k + 1);
  }, [canReuseCurrentWindow, confirmDiscard, prefs.defaultMode, prefs.openBehavior, t]);

  const writeTo = React.useCallback(
    (path: string, value: string) => {
      return saveFile(path, value)
        .then(() => {
          setFilePath(path);
          markSavedRef.current();
          rememberPath(path);
          // Our version is now on disk (and the watcher baseline is refreshed
          // in Rust), so any previously pending external change is resolved.
          setExternalChangePending(false);
          setBannerDismissed(false);
        })
        .catch((e) => message(e.message, {title: t('saveFailed'), kind: 'error'}));
    },
    [rememberPath, t],
  );

  const handleSaveAs = React.useCallback(async () => {
    const path = await pickSavePath(filePath ? basename(filePath) : `${t('untitled')}.md`);
    if (path) await writeTo(path, getValueRef.current());
  }, [filePath, writeTo, t]);

  const handleSave = React.useCallback(async () => {
    if (filePath && externalChangePending) {
      const overwrite = await ask(t('overwriteChangedQuestion'), {
        title: t('overwriteChangedTitle'),
        kind: 'warning',
      });
      if (!overwrite) return;
    }
    if (filePath) await writeTo(filePath, getValueRef.current());
    else await handleSaveAs();
  }, [filePath, externalChangePending, writeTo, handleSaveAs, t]);

  const handleCopyAgentContext = React.useCallback(async () => {
    if (!filePath) {
      await clearClipboard();
      showCopyAgentContextToast(t('agentContextNoFile'), 'warning');
      return;
    }

    try {
      const result = await copyAgentContextRef.current(filePath);
      if (result.status === 'copied') {
        showCopyAgentContextToast(`${t('agentContextCopied')}: ${result.location}`, 'success', 2500);
      }
      if (result.status === 'no-context') {
        await clearClipboard();
        showCopyAgentContextToast(t('agentContextNoSelection'), 'warning');
      }
      if (result.status === 'use-markup-mode') {
        await clearClipboard();
        showCopyAgentContextToast(t('agentContextUseMarkupMode'), 'warning');
      }
    } catch {
      await clearClipboard();
      showCopyAgentContextToast(t('agentContextCopyFailed'), 'danger');
    }
  }, [filePath, t]);

  const openRecent = React.useCallback(
    async (index: number) => {
      const path = recentFilesRef.current[index];
      if (!path) return;
      await openPathByPreference(path);
    },
    [openPathByPreference],
  );

  const clearRecentFiles = React.useCallback(() => {
    setRecentFiles([]);
    saveRecentFiles([]);
  }, []);

  const handleQuit = React.useCallback(async () => {
    await requestQuit();
  }, []);

  const handleRevert = React.useCallback(async () => {
    if (!filePath) return;
    if (dirty && !(await confirmDiscard())) return;
    void reloadFromDisk();
  }, [filePath, dirty, confirmDiscard, reloadFromDisk]);

  // Dispatch table kept current every render so the one-shot listeners below
  // always invoke fresh closures without re-subscribing.
  const actionsRef = React.useRef<Record<string, () => void>>({});
  actionsRef.current = {
    new: handleNew,
    open: handleOpen,
    save: handleSave,
    'save-as': handleSaveAs,
    revert: handleRevert,
    'copy-agent-context': () => void handleCopyAgentContext(),
    preferences: () => setPrefsOpen(true),
    'toggle-theme': () =>
      onUpdatePrefs({theme: resolvedTheme === 'light' ? 'dark' : 'light'}),
    'toggle-spellcheck': () => onUpdatePrefs({spellcheck: !prefs.spellcheck}),
    quit: handleQuit,
    'recent-clear': clearRecentFiles,
    ...Object.fromEntries(
      recentFiles.map((_, index) => [`recent-file-${index}`, () => void openRecent(index)]),
    ),
  };
  const openFromOsRef = React.useRef(openFromOs);
  openFromOsRef.current = openFromOs;

  // Wire native menu events, OS file-open events, and external file-change
  // notifications (subscribe once). Scope to the current window: the backend
  // targets these at the focused window via `emit_to`, but a global `listen`
  // registers with target `Any`, which Tauri delivers to every window.
  React.useEffect(() => {
    const win = getCurrentWindow();
    const unMenu = win.listen<string>('menu-action', (e) => actionsRef.current[e.payload]?.());
    const unOpen = win.listen<string>('open-file', (e) => openFromOsRef.current(e.payload));
    const unChanged = win.listen<string>('file-changed-on-disk', () => {
      // No local edits to lose: silently reload. Otherwise surface the banner.
      if (!dirtyRef.current) {
        void reloadFromDiskRef.current().then(() =>
          showFileReloadedToast(tRef.current('fileReloadedToast')),
        );
      } else {
        setExternalChangePending(true);
        setBannerDismissed(false);
      }
    });
    return () => {
      unMenu.then((f) => f());
      unOpen.then((f) => f());
      unChanged.then((f) => f());
    };
  }, []);

  // Keep the Rust file watcher in sync with the open document: watch the
  // current file, or stop watching when there is none (unsaved / new doc).
  React.useEffect(() => {
    if (!filePath) {
      unwatchFile().catch(() => {});
      return;
    }
    watchFile(filePath).catch(() => {});
  }, [filePath]);

  React.useEffect(() => {
    updateRecentFilesMenu(buildRecentFileMenuItems(recentFiles)).catch(() => {});
  }, [recentFiles]);

  React.useEffect(() => {
    setMenuLabels(buildMenuLabels(resolvedLang)).catch(() => {});
  }, [resolvedLang]);

  // Keep the native "Check Spelling" menu checkmark in sync with the preference,
  // including at startup and after another window toggles it (via prefs-updated).
  React.useEffect(() => {
    setSpellcheckChecked(prefs.spellcheck).catch(() => {});
  }, [prefs.spellcheck]);

  // Cold-start: tell Rust we're ready and open any buffered Finder request.
  React.useEffect(() => {
    frontendReady()
      .then((paths) => {
        if (paths.length) void loadPath(paths[paths.length - 1]);
      })
      .catch(() => {});
  }, [loadPath]);

  // Keep the native window title and macOS document-edited indicator in sync.
  // The leading '*' mirrors the native red-dot for unsaved changes in the title text.
  React.useEffect(() => {
    const name = filePath ? basename(filePath) : t('untitled');
    getCurrentWindow()
      .setTitle(`${dirty ? '* ' : ''}${name} — YFM Editor`)
      .catch(() => {});
    setDocumentEdited(dirty).catch(() => {});
    setRepresentedFile(filePath).catch(() => {});
  }, [filePath, dirty, t]);

  // Block window close when there are unsaved changes (subscribe once).
  React.useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (!dirtyRef.current) return;
      const discard = await ask(tRef.current('unsavedCloseQuestion'), {
        title: tRef.current('unsavedChangesTitle'),
        kind: 'warning',
      });
      if (!discard) {
        event.preventDefault();
        cancelQuit().catch(() => {});
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div className="app">
      <EditorPane
        key={`${docKey}:${activeMode}:${prefs.spellcheck}`}
        markup={markup}
        mode={activeMode}
        spellcheck={prefs.spellcheck}
        onDirtyChange={setDirty}
        onSubmit={() => void handleSave()}
        registerGetValue={(fn) => (getValueRef.current = fn)}
        registerMarkSaved={(fn) => (markSavedRef.current = fn)}
        registerReplaceContent={(fn) => (replaceContentRef.current = fn)}
        registerCopyAgentContext={(fn) => (copyAgentContextRef.current = fn)}
        reloadBanner={
          externalChangePending && !bannerDismissed ? (
            <div className="reload-banner" role="status">
              <span className="reload-banner__text">{t('fileChangedBanner')}</span>
              <div className="reload-banner__actions">
                <Button size="s" view="outlined-danger" onClick={() => void reloadFromDisk()}>
                  {t('reload')}
                </Button>
                <Button size="s" view="normal" onClick={() => setBannerDismissed(true)}>
                  {t('keepMine')}
                </Button>
              </div>
            </div>
          ) : null
        }
      />
      <footer className="statusbar">
        {filePath ? (
          <span className="statusbar__path" title={filePath}>
            <bdi>{prettifyDir(dirname(filePath), home)}</bdi>
          </span>
        ) : (
          <span className="statusbar__path statusbar__path_muted">{t('unsavedLocation')}</span>
        )}
      </footer>
      <PreferencesModal
        open={prefsOpen}
        prefs={prefs}
        onClose={() => setPrefsOpen(false)}
        onUpdate={onUpdatePrefs}
      />
    </div>
  );
}

function PreferencesModal({
  open,
  prefs,
  onClose,
  onUpdate,
}: {
  open: boolean;
  prefs: Preferences;
  onClose: () => void;
  onUpdate: (patch: Partial<Preferences>) => void;
}) {
  const {t} = useI18n();

  return (
    <Modal open={open} onClose={onClose}>
      <div className="prefs">
        <Text variant="header-1">{t('preferences')}</Text>
        <div className="prefs__row">
          <Text variant="subheader-1">{t('theme')}</Text>
          <SegmentedRadioGroup
            value={prefs.theme}
            onUpdate={(v: ThemePref) => onUpdate({theme: v})}
            options={[
              {value: 'light', content: t('themeLight')},
              {value: 'dark', content: t('themeDark')},
              {value: 'system', content: t('system')},
            ]}
          />
        </div>
        <div className="prefs__row">
          <Text variant="subheader-1">{t('language')}</Text>
          <SegmentedRadioGroup
            value={prefs.language}
            onUpdate={(v: LanguagePref) => onUpdate({language: v})}
            options={[
              {value: 'system', content: t('system')},
              {value: 'ru', content: t('languageRussian')},
              {value: 'en', content: t('languageEnglish')},
            ]}
          />
        </div>
        <div className="prefs__row">
          <Text variant="subheader-1">{t('defaultEditorMode')}</Text>
          <SegmentedRadioGroup
            value={prefs.defaultMode}
            onUpdate={(v: EditorMode) => onUpdate({defaultMode: v})}
            options={[
              {value: 'wysiwyg', content: t('modeWysiwyg')},
              {value: 'markup', content: t('modeMarkup')},
            ]}
          />
        </div>
        <Text variant="caption-1" color="secondary">
          {t('defaultModeHint')}
        </Text>
        <div className="prefs__row">
          <Text variant="subheader-1">{t('openBehavior')}</Text>
          <SegmentedRadioGroup
            value={prefs.openBehavior}
            onUpdate={(v: OpenBehaviorPref) => onUpdate({openBehavior: v})}
            options={[
              {value: 'newWindow', content: t('openBehaviorNewWindow')},
              {value: 'sameWindow', content: t('openBehaviorSameWindow')},
            ]}
          />
        </div>
        <Text variant="caption-1" color="secondary">
          {t('openBehaviorHint')}
        </Text>
      </div>
    </Modal>
  );
}
