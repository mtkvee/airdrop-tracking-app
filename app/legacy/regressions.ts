import { ensureArray } from './utils';

type SortDir = 'asc' | 'desc';

function cmpText(a: string, b: string, sortDir: SortDir): number {
  if (a === b) return 0;
  if (sortDir === 'asc') return a > b ? 1 : -1;
  return a < b ? 1 : -1;
}

export function compareProjectValues(a: any, b: any, sortKey: string, sortDir: SortDir): number {
  let va = a && sortKey in a ? a[sortKey] : '';
  let vb = b && sortKey in b ? b[sortKey] : '';

  if (sortKey === 'name' || sortKey === 'code' || sortKey === 'status') {
    return cmpText(String(va || '').toLowerCase(), String(vb || '').toLowerCase(), sortDir);
  }

  if (sortKey === 'taskType' || sortKey === 'connectType' || sortKey === 'rewardType') {
    return cmpText(
      ensureArray(va).join(', ').toLowerCase(),
      ensureArray(vb).join(', ').toLowerCase(),
      sortDir
    );
  }

  return 0;
}

export function parseImportPayload(parsed: any): {
  hasImportedContent: boolean;
  projects: unknown[];
  customOptions: Record<string, unknown[]> | null;
  lastUpdatedAt: number | null;
} {
  const projects = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.projects)
      ? parsed.projects
      : [];

  const hasCustomOptions = !!(parsed && parsed.customOptions);
  const hasLastUpdatedAt = !!(parsed && parsed.lastUpdatedAt);
  const hasProjects = projects.length > 0;

  return {
    hasImportedContent: hasCustomOptions || hasLastUpdatedAt || hasProjects,
    projects,
    customOptions: hasCustomOptions ? parsed.customOptions : null,
    lastUpdatedAt: hasLastUpdatedAt ? Number(parsed.lastUpdatedAt) : null,
  };
}
