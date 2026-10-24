// UI state belongs to this installation, never to the Markdown document.
const STORAGE_KEY = 'yfm-editor.outline-documents';

function readOpenDocuments(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((path): path is string => typeof path === 'string') : [];
  } catch {
    return [];
  }
}

export function loadOutlineOpen(path: string): boolean {
  return readOpenDocuments().includes(path);
}

export function saveOutlineOpen(path: string, open: boolean): void {
  const paths = readOpenDocuments().filter((item) => item !== path);
  if (open) paths.push(path);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths.slice(-200)));
  } catch {
    // Navigation remains available when persistent browser storage is disabled.
  }
}
