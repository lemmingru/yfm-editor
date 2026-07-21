import React from 'react';
import type {LanguagePref} from './preferences';

export type Lang = 'en' | 'ru';

export type MenuLabels = {
  preferences: string;
  quit: string;
  file: string;
  new: string;
  open: string;
  openRecent: string;
  noRecentFiles: string;
  clearMenu: string;
  save: string;
  saveAs: string;
  revert: string;
  edit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  copyAgentContext: string;
  paste: string;
  selectAll: string;
  window: string;
  minimize: string;
  zoom: string;
  bringAllToFront: string;
  view: string;
  toggleTheme: string;
  spellCheck: string;
};

const messages = {
  en: {
    unsavedChangesTitle: 'Unsaved changes',
    unsavedDiscardQuestion: 'You have unsaved changes. Discard them?',
    unsavedCloseQuestion: 'You have unsaved changes. Close without saving?',
    openFailed: 'Open failed',
    saveFailed: 'Save failed',
    untitled: 'Untitled',
    unsavedLocation: 'Not saved to disk yet',
    fileReloadedToast: 'File updated from disk.',
    fileChangedBanner: 'The file changed on disk. You have unsaved changes.',
    reload: 'Discard and Reload',
    keepMine: 'Keep Editing My Version',
    overwriteChangedTitle: 'File changed on disk',
    overwriteChangedQuestion:
      'The file has changed on disk since you opened it. Overwrite the disk version with your changes?',
    agentContextNoFile: 'Save the file to copy agent context.',
    agentContextNoSelection: 'Could not determine editor context.',
    agentContextUseMarkupMode:
      'Could not determine Markdown source in visual mode. Switch to Markdown markup mode and try again.',
    agentContextCopyFailed: 'Could not copy agent context.',
    agentContextCopied: 'Copied agent context',
    preferences: 'Preferences',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    system: 'System',
    language: 'Language',
    languageRussian: 'Russian',
    languageEnglish: 'English',
    defaultEditorMode: 'Default editor mode',
    modeWysiwyg: 'WYSIWYG',
    modeMarkup: 'Markup',
    defaultModeHint: 'Default mode applies to the next opened document.',
    openBehavior: 'Opening documents',
    openBehaviorNewWindow: 'New window',
    openBehaviorSameWindow: 'Current window',
    openBehaviorHint: 'New window is the native macOS behavior for documents.',
  },
  ru: {
    unsavedChangesTitle: 'Несохранённые изменения',
    unsavedDiscardQuestion: 'Есть несохранённые изменения. Отбросить их?',
    unsavedCloseQuestion: 'Есть несохранённые изменения. Закрыть без сохранения?',
    openFailed: 'Не удалось открыть',
    saveFailed: 'Не удалось сохранить',
    untitled: 'Без названия',
    unsavedLocation: 'Ещё не сохранён на диск',
    fileReloadedToast: 'Файл обновлён с диска.',
    fileChangedBanner: 'Файл изменён на диске. У вас есть несохранённые правки.',
    reload: 'Отбросить и загрузить',
    keepMine: 'Редактировать мою версию',
    overwriteChangedTitle: 'Файл изменён на диске',
    overwriteChangedQuestion:
      'Файл на диске изменился с момента открытия. Перезаписать его вашими изменениями?',
    agentContextNoFile: 'Сохраните файл, чтобы скопировать контекст для агента.',
    agentContextNoSelection: 'Не удалось определить контекст в редакторе.',
    agentContextUseMarkupMode:
      'Не удалось определить исходную Markdown-разметку в визуальном режиме. Переключитесь в режим разметки Markdown и повторите операцию.',
    agentContextCopyFailed: 'Не удалось скопировать контекст для агента.',
    agentContextCopied: 'Контекст для агента скопирован',
    preferences: 'Настройки',
    theme: 'Тема',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    system: 'Система',
    language: 'Язык',
    languageRussian: 'Русский',
    languageEnglish: 'English',
    defaultEditorMode: 'Режим редактора по умолчанию',
    modeWysiwyg: 'WYSIWYG',
    modeMarkup: 'Разметка',
    defaultModeHint: 'Режим по умолчанию применяется к следующему открытому документу.',
    openBehavior: 'Открытие документов',
    openBehaviorNewWindow: 'Новое окно',
    openBehaviorSameWindow: 'Текущее окно',
    openBehaviorHint: 'Новое окно — нативное поведение macOS для документов.',
  },
} as const;

const menuLabels: Record<Lang, MenuLabels> = {
  en: {
    preferences: 'Preferences…',
    quit: 'Quit YFM Editor',
    file: 'File',
    new: 'New',
    open: 'Open…',
    openRecent: 'Open Recent',
    noRecentFiles: 'No Recent Files',
    clearMenu: 'Clear Menu',
    save: 'Save',
    saveAs: 'Save As…',
    revert: 'Revert to Saved',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    copyAgentContext: 'Copy Agent Context',
    paste: 'Paste',
    selectAll: 'Select All',
    window: 'Window',
    minimize: 'Minimize',
    zoom: 'Zoom',
    bringAllToFront: 'Bring All to Front',
    view: 'View',
    toggleTheme: 'Toggle Theme',
    spellCheck: 'Check Spelling',
  },
  ru: {
    preferences: 'Настройки…',
    quit: 'Завершить YFM Editor',
    file: 'Файл',
    new: 'Новый',
    open: 'Открыть…',
    openRecent: 'Открыть недавние',
    noRecentFiles: 'Нет недавних файлов',
    clearMenu: 'Очистить меню',
    save: 'Сохранить',
    saveAs: 'Сохранить как…',
    revert: 'Вернуть к сохранённому',
    edit: 'Правка',
    undo: 'Отменить',
    redo: 'Повторить',
    cut: 'Вырезать',
    copy: 'Копировать',
    copyAgentContext: 'Копировать контекст для агента',
    paste: 'Вставить',
    selectAll: 'Выбрать всё',
    window: 'Окно',
    minimize: 'Свернуть',
    zoom: 'Масштаб',
    bringAllToFront: 'Все окна на передний план',
    view: 'Вид',
    toggleTheme: 'Переключить тему',
    spellCheck: 'Проверка орфографии',
  },
};

export type MessageKey = keyof typeof messages.en;

type I18nContextValue = {
  lang: Lang;
  t: (key: MessageKey) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function resolveLang(pref: LanguagePref, systemLang = navigator.language): Lang {
  if (pref === 'ru' || pref === 'en') return pref;
  return systemLang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function buildMenuLabels(lang: Lang): MenuLabels {
  return menuLabels[lang];
}

export function I18nProvider({lang, children}: {lang: Lang; children: React.ReactNode}) {
  const value = React.useMemo<I18nContextValue>(
    () => ({
      lang,
      t: (key) => messages[lang][key],
    }),
    [lang],
  );

  return React.createElement(I18nContext.Provider, {value}, children);
}

export function useI18n(): I18nContextValue {
  const value = React.useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider');
  return value;
}
