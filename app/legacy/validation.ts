import { ensureArray } from './utils';

type LinkEntry = { type?: string; url?: string };

function isHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

export function validateProjectLinks(data: { link?: string; sideLinks?: LinkEntry[] }): {
  errors: string[];
  invalidMain: boolean;
  invalidSideIndexes: number[];
} {
  const errors: string[] = [];
  const invalidSideIndexes: number[] = [];
  const main = String((data && data.link) || '').trim();
  let invalidMain = false;

  if (main && !isHttpUrl(main)) {
    errors.push('Main link must be a valid http(s) URL');
    invalidMain = true;
  }

  const sideLinks = ensureArray((data && data.sideLinks) || []);
  sideLinks.forEach(function (entry, idx) {
    const url = String((entry && entry.url) || '').trim();
    if (!url) return;
    if (!isHttpUrl(url)) {
      errors.push('Sub link #' + (idx + 1) + ' must be a valid http(s) URL');
      invalidSideIndexes.push(idx);
    }
  });

  return { errors, invalidMain, invalidSideIndexes };
}
