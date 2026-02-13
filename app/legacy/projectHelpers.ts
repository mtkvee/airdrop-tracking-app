import { ensureArray, ensureArrayOr } from './utils';
import { normalizeSideLinks } from './sideLinks';
import type { Project, SideLink } from './types';

type ProjectFormData = {
  id?: number | null;
  name?: string;
  code?: string;
  link?: string;
  sideLinks?: SideLink[];
  note?: string;
  taskType?: string[] | string;
  connectType?: string[] | string;
  taskCost?: string | number;
  taskTime?: string | number;
  status?: string;
  statusDate?: string;
  rewardType?: string[] | string;
};

function getNextProjectId(projects: Project[]): number {
  return projects.length ? Math.max.apply(null, projects.map(function (p) { return p.id; })) + 1 : 1;
}

export function projectToFormData(project: Project): ProjectFormData {
  const sideLinks = normalizeSideLinks(ensureArrayOr(project.sideLinks, []));
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    link: project.link || '',
    sideLinks: sideLinks,
    note: project.note || '',
    taskType: ensureArray(project.taskType).slice(),
    connectType: ensureArray(project.connectType).slice(),
    taskCost: project.taskCost != null ? project.taskCost : '',
    taskTime: project.taskTime != null ? project.taskTime : '',
    status: project.status || 'potential',
    statusDate: project.statusDate || '',
    rewardType: ensureArrayOr(project.rewardType, []).slice(),
  };
}

export function formDataToProject(
  data: ProjectFormData,
  existingId: number | null,
  projects: Project[]
): Project {
  const id = existingId || getNextProjectId(projects);
  const name = (data.name || '').trim();
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const now = Date.now();
  const existing = existingId ? (projects.find(function (p) { return p.id === existingId; }) || null) : null;
  return {
    id: id,
    name: name,
    code: (data.code || '').trim(),
    link: ((data.link || '').trim() || null) as unknown as string,
    sideLinks: normalizeSideLinks(ensureArray(data.sideLinks)),
    note: (data.note || '').trim(),
    logo: '',
    initial: initial,
    favorite: existing ? !!existing.favorite : false,
    taskType: ensureArray(data.taskType),
    connectType: ensureArray(data.connectType),
    taskCost: data.taskCost !== '' && data.taskCost != null ? Number(data.taskCost) : 0,
    taskTime: data.taskTime !== '' && data.taskTime != null ? Number(data.taskTime) : 3,
    status: data.status || 'potential',
    statusDate: (data.statusDate || '').trim() || '',
    rewardType: ensureArrayOr(data.rewardType, []),
    logos: existing ? (existing.logos || []) : [],
    lastEdited: now,
  };
}

function normalizeLinkForDedup(value: string): string {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.replace(/\/+$/, '');
    return (parsed.origin + path).toLowerCase();
  } catch (err) {
    return value.toLowerCase();
  }
}

export function hasProjectDuplicate(projects: Project[], formData: ProjectFormData): boolean {
  const nameVal = (formData.name || '').trim();
  const codeVal = (formData.code || '').trim().toUpperCase();
  const linkVal = normalizeLinkForDedup((formData.link || '').trim());
  return projects.some(function (p) {
    if (p.id === formData.id) return false;
    const sameName = p.name && p.name.toLowerCase() === nameVal.toLowerCase();
    const sameCode = codeVal && p.code && String(p.code).toUpperCase() === codeVal;
    const sameLink = linkVal && normalizeLinkForDedup(p.link || '') === linkVal;
    return sameName || sameCode || sameLink;
  });
}
