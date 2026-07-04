export const RECENT_FILES_LIMIT = 10;

const STORAGE_KEY = 'yfm-editor.recentFiles';
const MAX_MENU_LABEL_LENGTH = 88;

export type RecentFileMenuItem = {
  label: string;
};

export function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function saveRecentFiles(paths: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths.slice(0, RECENT_FILES_LIMIT)));
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function rememberRecentFile(paths: string[], path: string): string[] {
  return [path, ...paths.filter((item) => item !== path)].slice(0, RECENT_FILES_LIMIT);
}

export function buildRecentFileMenuItems(paths: string[]): RecentFileMenuItem[] {
  return paths.map((path, index) => ({
    label: `${index + 1}. ${basename(path)}${parentLabel(path, paths)}`,
  }));
}

function basename(path: string): string {
  const parts = splitDisplayPath(path);
  return parts[parts.length - 1] || path;
}

function dirname(path: string): string {
  const normalized = normalizeSeparators(path);
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

function parentLabel(path: string, allPaths: string[]): string {
  const parent = dirname(path);
  if (!parent) return '';

  const fileName = basename(path);
  const fullParent = compactHome(parent);
  const fullLabel = ` — ${fullParent}`;
  if (`${fileName}${fullLabel}`.length <= MAX_MENU_LABEL_LENGTH) return fullLabel;

  const suffix = uniqueParentSuffix(path, allPaths);
  const compactLabel = ` — ${suffix}`;
  if (`${fileName}${compactLabel}`.length <= MAX_MENU_LABEL_LENGTH) return compactLabel;

  const available = Math.max(20, MAX_MENU_LABEL_LENGTH - fileName.length - 3);
  return ` — ${truncateMiddle(suffix, available)}`;
}

function uniqueParentSuffix(path: string, allPaths: string[]): string {
  const sameBasenamePaths = allPaths.filter((item) => basename(item) === basename(path));
  const targetSegments = splitDisplayPath(dirname(path));

  for (let depth = 2; depth <= targetSegments.length; depth += 1) {
    const suffix = targetSegments.slice(-depth).join('/');
    const isUnique = sameBasenamePaths.every((item) => {
      if (item === path) return true;
      return splitDisplayPath(dirname(item)).slice(-depth).join('/') !== suffix;
    });
    if (isUnique) return `…/${suffix}`;
  }

  return `…/${targetSegments.slice(-Math.min(4, targetSegments.length)).join('/')}`;
}

function splitDisplayPath(path: string): string[] {
  return normalizeSeparators(path).split('/').filter(Boolean);
}

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/');
}

function compactHome(path: string): string {
  return normalizeSeparators(path).replace(/^\/Users\/[^/]+/, '~');
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const keep = Math.max(8, Math.floor((maxLength - 1) / 2));
  return `${value.slice(0, keep)}…${value.slice(value.length - keep)}`;
}
