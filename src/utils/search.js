/**
 * Prefix search on a multikey `searchTokens` index.
 *
 * Each document stores the lower-cased words of its searchable fields
 * (e.g. "Dr. Ayesha Rahman" → ["dr", "ayesha", "rahman"]). A query is split
 * the same way and every term must match the start of some token, using an
 * anchored regex (/^term/) — which MongoDB can answer from the index, unlike
 * an unanchored or case-insensitive regex that forces a collection scan.
 */
const SPLIT = /[^\p{L}\p{N}]+/u;
const MAX_TERMS = 5;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function tokenize(...values) {
  const tokens = new Set();
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    for (const part of String(value).toLowerCase().split(SPLIT)) {
      if (part) tokens.add(part);
    }
  }
  return [...tokens];
}

/** "+880 1711-000000" → "8801711000000", so a phone can be searched as one number. */
export function digitsOnly(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

export function buildSearchTokens(textFields = [], phone) {
  const tokens = tokenize(...textFields);
  const digits = digitsOnly(phone);
  if (digits && !tokens.includes(digits)) tokens.push(digits);
  return tokens;
}

export function buildSearchFilter(search) {
  if (!search) return {};
  const terms = tokenize(search).slice(0, MAX_TERMS);
  if (!terms.length) return {};
  return {
    $and: terms.map((term) => ({ searchTokens: new RegExp(`^${escapeRegex(term)}`) })),
  };
}
