import React from 'react';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchFile: vi.fn(),
  saveFile: vi.fn(),
  pickSavePath: vi.fn(),
  frontendReady: vi.fn(),
  watchFile: vi.fn(),
  unwatchFile: vi.fn(),
  setDocumentEdited: vi.fn(),
  setRepresentedFile: vi.fn(),
  updateRecentFilesMenu: vi.fn(),
  setMenuLabels: vi.fn(),
  windowListeners: new Map<string, (event: {payload: string}) => void>(),
  setTitle: vi.fn(),
}));

vi.mock('./api/client', () => ({
  fetchFile: mocks.fetchFile,
  saveFile: mocks.saveFile,
  pickOpenPath: vi.fn().mockResolvedValue(null),
  pickSavePath: mocks.pickSavePath,
  frontendReady: mocks.frontendReady,
  setDocumentEdited: mocks.setDocumentEdited,
  updateRecentFilesMenu: mocks.updateRecentFilesMenu,
  setMenuLabels: mocks.setMenuLabels,
  setSpellcheckChecked: vi.fn().mockResolvedValue(undefined),
  requestQuit: vi.fn().mockResolvedValue(undefined),
  cancelQuit: vi.fn().mockResolvedValue(undefined),
  openFileWindow: vi.fn().mockResolvedValue(undefined),
  setRepresentedFile: mocks.setRepresentedFile,
  watchFile: mocks.watchFile,
  unwatchFile: mocks.unwatchFile,
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock('@tauri-apps/api/path', () => ({homeDir: vi.fn().mockResolvedValue('/Users/test')}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn().mockResolvedValue(true),
  message: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    listen: (name: string, callback: (event: {payload: string}) => void) => {
      mocks.windowListeners.set(name, callback);
      return Promise.resolve(() => {});
    },
    onCloseRequested: vi.fn().mockResolvedValue(() => {}),
    setTitle: mocks.setTitle,
  }),
}));

vi.mock('./i18n', () => {
  const t = (key: string) => key;
  return {
    buildMenuLabels: () => ({file: 'File'}),
    resolveLang: () => 'en',
    I18nProvider: ({children}: {children: React.ReactNode}) => children,
    useI18n: () => ({t}),
  };
});

vi.mock('@gravity-ui/uikit', () => ({
  configure: vi.fn(),
  Lang: {En: 'en'},
  ThemeProvider: ({children}: {children: React.ReactNode}) => children,
  ToasterProvider: ({children}: {children: React.ReactNode}) => children,
  ToasterComponent: () => null,
  Toaster: class {
    remove() {}
    add() {}
  },
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Modal: ({children, open}: {children: React.ReactNode; open: boolean}) =>
    open ? <div>{children}</div> : null,
  Text: ({children}: {children: React.ReactNode}) => <span>{children}</span>,
  SegmentedRadioGroup: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
}));

vi.mock('@gravity-ui/markdown-editor', () => ({configure: vi.fn(), Lang: {En: 'en'}}));
vi.mock('@yfm-editor/core', () => ({
  EditorPane: ({
    markup,
    onDirtyChange,
    registerGetValue,
    registerMarkSaved,
    registerReplaceContent,
    registerCopyAgentContext,
    reloadBanner,
  }: {
    markup: string;
    onDirtyChange: (dirty: boolean) => void;
    registerGetValue: (fn: () => string) => void;
    registerMarkSaved: (fn: () => void) => void;
    registerReplaceContent: (fn: (value: string) => void) => void;
    registerCopyAgentContext: (fn: () => Promise<{status: 'no-context'}>) => void;
    reloadBanner: React.ReactNode;
  }) => {
    registerGetValue(() => 'edited content');
    registerMarkSaved(() => onDirtyChange(false));
    registerReplaceContent(() => {});
    registerCopyAgentContext(async () => ({status: 'no-context'}));
    return (
      <div>
        <output data-testid="markup">{markup}</output>
        <button onClick={() => onDirtyChange(true)}>make-dirty</button>
        {reloadBanner}
      </div>
    );
  },
}));

import {App} from './App';

describe('desktop application workflow', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
    mocks.windowListeners.clear();
    mocks.fetchFile.mockReset().mockResolvedValue({path: '/cold.md', content: '# Cold start'});
    mocks.saveFile.mockReset().mockResolvedValue(undefined);
    mocks.pickSavePath.mockReset().mockResolvedValue('/saved.md');
    mocks.frontendReady.mockReset().mockResolvedValue([]);
    for (const mock of [
      mocks.watchFile,
      mocks.unwatchFile,
      mocks.setDocumentEdited,
      mocks.setRepresentedFile,
      mocks.updateRecentFilesMenu,
      mocks.setMenuLabels,
      mocks.setTitle,
    ]) {
      mock.mockReset().mockResolvedValue(undefined);
    }
  });

  it('loads a cold-start document and starts watching it', async () => {
    mocks.frontendReady.mockResolvedValue(['/cold.md']);
    render(<App />);

    expect(await screen.findByText('# Cold start')).toBeInTheDocument();
    expect(mocks.fetchFile).toHaveBeenCalledWith('/cold.md');
    await waitFor(() => expect(mocks.watchFile).toHaveBeenCalledWith('/cold.md'));
    expect(mocks.setRepresentedFile).toHaveBeenLastCalledWith('/cold.md');
  });

  it('saves an untitled dirty document through Save As', async () => {
    render(<App />);
    await waitFor(() => expect(mocks.windowListeners.has('menu-action')).toBe(true));
    fireEvent.click(screen.getByText('make-dirty'));

    await act(async () => {
      mocks.windowListeners.get('menu-action')!({payload: 'save'});
    });

    await waitFor(() =>
      expect(mocks.saveFile).toHaveBeenCalledWith('/saved.md', 'edited content'),
    );
    expect(mocks.setDocumentEdited).toHaveBeenLastCalledWith(false);
  });

  it('shows the external-change banner instead of overwriting dirty content', async () => {
    mocks.frontendReady.mockResolvedValue(['/cold.md']);
    render(<App />);
    await screen.findByText('# Cold start');
    fireEvent.click(screen.getByText('make-dirty'));

    act(() => {
      mocks.windowListeners.get('file-changed-on-disk')!({payload: '/cold.md'});
    });

    expect(await screen.findByText('fileChangedBanner')).toBeInTheDocument();
    expect(mocks.fetchFile).toHaveBeenCalledTimes(1);
  });
});
