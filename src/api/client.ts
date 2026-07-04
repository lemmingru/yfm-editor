import {invoke} from '@tauri-apps/api/core';
import {open, save} from '@tauri-apps/plugin-dialog';
import type {MenuLabels} from '../i18n';
import type {RecentFileMenuItem} from '../recentFiles';

const MD_FILTERS = [{name: 'Markdown', extensions: ['md', 'markdown', 'mdx']}];

/** Read a file from disk by absolute path (Rust `read_file` command). */
export function fetchFile(path: string): Promise<{path: string; content: string}> {
  return invoke<{path: string; content: string}>('read_file', {path});
}

/** Write content to disk at the given absolute path (Rust `write_file` command). */
export function saveFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_file', {path, content});
}

/** Mark the native window as having unsaved document changes on macOS. */
export function setDocumentEdited(edited: boolean): Promise<void> {
  return invoke<void>('set_document_edited', {edited});
}

/**
 * Point the macOS title-bar proxy icon at the given file (null clears it).
 * Enables Cmd/right-click on the window title to reveal the file's full path.
 */
export function setRepresentedFile(path: string | null): Promise<void> {
  return invoke<void>('set_represented_file', {path});
}

/** Rebuild the native File menu's recent-files submenu. */
export function updateRecentFilesMenu(items: RecentFileMenuItem[]): Promise<void> {
  return invoke<void>('update_recent_files_menu', {items});
}

/** Rebuild the native menu with localized labels. */
export function setMenuLabels(labels: MenuLabels): Promise<void> {
  return invoke<void>('set_menu_labels', {labels});
}

/** Ask Rust to close all windows; each window can still cancel via its close guard. */
export function requestQuit(): Promise<void> {
  return invoke<void>('request_quit');
}

/** Cancel an in-flight app quit after a window's unsaved-changes guard rejects closing. */
export function cancelQuit(): Promise<void> {
  return invoke<void>('cancel_quit');
}

/** Create a new editor window, optionally preloaded with a document path. */
export function openFileWindow(path?: string): Promise<void> {
  return invoke<void>('open_file_window', {path: path ?? null});
}

/** Native open dialog; resolves to the chosen absolute path or null if cancelled. */
export async function pickOpenPath(): Promise<string | null> {
  const selected = await open({multiple: false, directory: false, filters: MD_FILTERS});
  return typeof selected === 'string' ? selected : null;
}

/** Native save dialog; resolves to the chosen absolute path or null if cancelled. */
export function pickSavePath(defaultName = 'Untitled.md'): Promise<string | null> {
  return save({defaultPath: defaultName, filters: MD_FILTERS});
}

/**
 * Tell the Rust core the webview is ready; returns any file paths the OS asked
 * us to open during a cold start (Finder "open with"), buffered until now.
 */
export function frontendReady(): Promise<string[]> {
  return invoke<string[]>('frontend_ready');
}
