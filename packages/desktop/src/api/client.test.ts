import {beforeEach, describe, expect, it, vi} from 'vitest';

const {invoke, open, save} = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({invoke}));
vi.mock('@tauri-apps/plugin-dialog', () => ({open, save}));

import {
  cancelQuit,
  fetchFile,
  frontendReady,
  openFileWindow,
  pickOpenPath,
  pickSavePath,
  requestQuit,
  saveFile,
  setDocumentEdited,
  setRepresentedFile,
  unwatchFile,
  updateRecentFilesMenu,
  watchFile,
} from './client';

describe('Tauri API client contract', () => {
  beforeEach(() => {
    invoke.mockResolvedValue(undefined);
    open.mockReset();
    save.mockReset();
  });

  it.each([
    [() => fetchFile('/a.md'), 'read_file', {path: '/a.md'}],
    [() => saveFile('/a.md', 'text'), 'write_file', {path: '/a.md', content: 'text'}],
    [() => watchFile('/a.md'), 'watch_file', {path: '/a.md'}],
    [() => unwatchFile(), 'unwatch_file', undefined],
    [() => setDocumentEdited(true), 'set_document_edited', {edited: true}],
    [() => setRepresentedFile('/a.md'), 'set_represented_file', {path: '/a.md'}],
    [() => requestQuit(), 'request_quit', undefined],
    [() => cancelQuit(), 'cancel_quit', undefined],
    [() => openFileWindow('/a.md'), 'open_file_window', {path: '/a.md'}],
    [() => frontendReady(), 'frontend_ready', undefined],
  ] as const)('maps its wrapper to %s', async (call, command, args) => {
    await call();
    if (args === undefined) {
      expect(invoke).toHaveBeenLastCalledWith(command);
    } else {
      expect(invoke).toHaveBeenLastCalledWith(command, args);
    }
  });

  it('passes recent menu items without changing their shape', async () => {
    const items = [{label: '1. a.md — /docs'}];
    await updateRecentFilesMenu(items);
    expect(invoke).toHaveBeenCalledWith('update_recent_files_menu', {items});
  });

  it('normalizes a cancelled or non-string open dialog result', async () => {
    open.mockResolvedValue(null);
    await expect(pickOpenPath()).resolves.toBeNull();
    open.mockResolvedValue(['/a.md']);
    await expect(pickOpenPath()).resolves.toBeNull();
  });

  it('uses Markdown filters for open and save dialogs', async () => {
    open.mockResolvedValue('/a.md');
    save.mockResolvedValue('/b.md');
    await expect(pickOpenPath()).resolves.toBe('/a.md');
    await expect(pickSavePath('draft.md')).resolves.toBe('/b.md');
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({multiple: false, directory: false}),
    );
    expect(save).toHaveBeenCalledWith(expect.objectContaining({defaultPath: 'draft.md'}));
  });
});
