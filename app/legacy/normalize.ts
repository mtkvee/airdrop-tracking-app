// @ts-nocheck
import { ensureArray, ensureArrayOr } from './utils';
import { normalizeSideLinks } from './sideLinks';

const MAX_ARRAY = 20;
const MAX_NAME = 80;
const MAX_CODE = 20;
const MAX_LINK = 2048;
const MAX_STATUS_DATE = 40;
const MAX_NOTE = 280;

function clampString(value, max) {
  const str = value == null ? '' : String(value);
  return str.length > max ? str.slice(0, max) : str;
}

function clampArray(values, max) {
  return values.slice(0, max).map(function (v) { return clampString(v, 32); });
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeProjects(list) {
  return (list || []).map(function (p) {
    const taskTypeSource = (p.taskType != null && p.taskType !== '') ? p.taskType : p.task;
    const taskType = clampArray(ensureArray(taskTypeSource), MAX_ARRAY);
    const connectType = clampArray(ensureArray(p.connectType), MAX_ARRAY);
    const rewardType = clampArray(ensureArrayOr(p.rewardType, []), MAX_ARRAY);
    const rawSideLinks = Array.isArray(p.sideLinks)
      ? p.sideLinks
      : Array.isArray(p.extraLinks)
        ? p.extraLinks
        : [
            p.sideLinks && p.sideLinks.x,
            p.sideLinks && p.sideLinks.discord,
            p.sideLinks && p.sideLinks.telegram,
            p.xLink,
            p.discordLink,
            p.telegramLink,
          ];
    const sideLinks = normalizeSideLinks(rawSideLinks)
      .map(function (item) {
        return {
          type: clampString(item.type, 32),
          url: clampString(item.url, MAX_LINK),
        };
      })
      .filter(function (v) { return !!v; })
      .slice(0, MAX_ARRAY);
    return {
      id: toNumber(p.id, Date.now()),
      name: clampString(p.name, MAX_NAME),
      code: clampString(p.code, MAX_CODE),
      link: clampString(p.link, MAX_LINK),
      sideLinks: sideLinks,
      logo: p.logo || '',
      initial: (p.name && p.name.charAt(0)) ? p.name.charAt(0).toUpperCase() : '?',
      favorite: !!p.favorite,
      taskType: taskType,
      connectType: connectType,
      taskCost: toNumber(p.taskCost, 0),
      taskTime: toNumber(p.taskTime, 3),
      status: clampString(p.status || 'potential', 24),
      statusDate: clampString(p.statusDate, MAX_STATUS_DATE),
      note: clampString(p.note, MAX_NOTE),
      rewardType: rewardType,
      logos: Array.isArray(p.logos) ? p.logos.slice(0, 10) : [],
      lastEdited: toNumber(p.lastEdited || p.createdAt, Date.now()),
    };
  });
}
