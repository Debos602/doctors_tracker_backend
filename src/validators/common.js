import { z } from 'zod';
import { PAGINATION } from '../constants.js';

export const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParams = z.object({ id: objectId });

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);

/** Accepts ISO strings; a bare "YYYY-MM-DD" in `to` means the end of that day (UTC). */
const dateBoundary = (endOfDay) =>
  z.preprocess((value) => {
    const v = emptyToUndefined(value);
    if (typeof v === 'string' && DATE_ONLY.test(v)) {
      return endOfDay ? `${v}T23:59:59.999Z` : `${v}T00:00:00.000Z`;
    }
    return v;
  }, z.coerce.date().optional());

export const dateFrom = dateBoundary(false);
export const dateTo = dateBoundary(true);

export const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

export const listQueryBase = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  q: z.string().trim().max(100).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  from: dateFrom,
  to: dateTo,
};

export const withValidDateRange = (schema) =>
  schema.refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: '"from" must be on or before "to"',
    path: ['from'],
  });

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{7,20}$/, 'Invalid phone number');

export const email = z.string().trim().toLowerCase().email('Invalid email').max(150);

/** Optional field where "" or null on create means "not provided". */
export const optional = (schema) => z.preprocess(emptyToUndefined, schema.optional());

/** Optional field where "" on update means "clear this value". */
export const clearable = (schema) => z.union([z.literal(''), schema]).optional();

/** Accepts "a,b" or ?x=a&x=b and validates each value against an enum. */
export const enumList = (values) =>
  z.preprocess(
    (value) => {
      const v = emptyToUndefined(value);
      return typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v;
    },
    z.array(z.enum(values)).min(1).optional(),
  );

export const atLeastOneField = (schema) =>
  schema.refine((obj) => Object.values(obj).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });
