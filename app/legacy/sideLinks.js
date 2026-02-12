// @ts-nocheck
import { sanitizeUrl } from './utils';

export function normalizeSideLinks(rawSideLinks) {
  return (rawSideLinks || [])
    .map(function (item) {
      if (item && typeof item === 'object') {
        const type = String(item.type || '').trim();
        const url = String(item.url || '').trim();
        if (!url) return null;
        return { type: type, url: url };
      }
      const url = String(item || '').trim();
      if (!url) return null;
      return { type: '', url: url };
    })
    .filter(function (x) { return !!x; });
}

export function sideLinkIcon(type, host) {
  const t = String(type || '').toLowerCase();
  if (t === 'x' || t === 'twitter' || (host && (host.indexOf('x.com') >= 0 || host.indexOf('twitter.com') >= 0))) return 'fa-brands fa-x-twitter';
  if (t === 'discord' || (host && host.indexOf('discord') >= 0)) return 'fa-brands fa-discord';
  if (t === 'telegram' || (host && (host.indexOf('t.me') >= 0 || host.indexOf('telegram') >= 0))) return 'fa-brands fa-telegram';
  if (t === 'github' || (host && host.indexOf('github.com') >= 0)) return 'fa-brands fa-github';
  return 'fas fa-link';
}

export function toRenderableSideLinks(rawSideLinks, getTypeLabel) {
  return normalizeSideLinks(rawSideLinks).map(function (entry) {
    const href = sanitizeUrl(entry.url);
    if (!href) return null;
    let host = '';
    try {
      host = new URL(href).hostname.replace(/^www\./, '');
    } catch (e) {}
    let label = getTypeLabel ? getTypeLabel(entry.type) : entry.type;
    if (!label || String(label).toLowerCase() === 'website') label = host || 'Link';
    return {
      type: entry.type,
      href: href,
      label: label,
      icon: sideLinkIcon(entry.type, host),
    };
  }).filter(function (x) { return !!x; });
}
