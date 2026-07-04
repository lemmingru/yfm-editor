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
  export: string;
  exportHtml: string;
  exportPdf: string;
  edit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  selectAll: string;
  window: string;
  minimize: string;
  zoom: string;
  bringAllToFront: string;
  view: string;
  toggleTheme: string;
};

const messages = {
  en: {
    unsavedChangesTitle: 'Unsaved changes',
    unsavedDiscardQuestion: 'You have unsaved changes. Discard them?',
    unsavedCloseQuestion: 'You have unsaved changes. Close without saving?',
    openFailed: 'Open failed',
    saveFailed: 'Save failed',
    saved: 'Saved',
    comingSoon: 'coming soon',
    htmlExport: 'HTML export',
    pdfExport: 'PDF export',
    untitled: 'Untitled',
    unsavedLocation: 'Not saved to disk yet',
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
    saved: 'Сохранено',
    comingSoon: 'скоро будет доступно',
    htmlExport: 'Экспорт HTML',
    pdfExport: 'Экспорт PDF',
    untitled: 'Без названия',
    unsavedLocation: 'Ещё не сохранён на диск',
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
    export: 'Export',
    exportHtml: 'HTML…',
    exportPdf: 'PDF…',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    window: 'Window',
    minimize: 'Minimize',
    zoom: 'Zoom',
    bringAllToFront: 'Bring All to Front',
    view: 'View',
    toggleTheme: 'Toggle Theme',
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
    export: 'Экспорт',
    exportHtml: 'HTML…',
    exportPdf: 'PDF…',
    edit: 'Правка',
    undo: 'Отменить',
    redo: 'Повторить',
    cut: 'Вырезать',
    copy: 'Копировать',
    paste: 'Вставить',
    selectAll: 'Выбрать всё',
    window: 'Окно',
    minimize: 'Свернуть',
    zoom: 'Масштаб',
    bringAllToFront: 'Все окна на передний план',
    view: 'Вид',
    toggleTheme: 'Переключить тему',
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
