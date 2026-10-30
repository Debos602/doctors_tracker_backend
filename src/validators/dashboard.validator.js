import { z } from 'zod';
import { dateFrom, dateTo, withValidDateRange } from './common.js';

const isValidTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const dashboardSummarySchema = {
  query: withValidDateRange(
    z.object({
      from: dateFrom,
      to: dateTo,
      granularity: z.enum(['auto', 'day', 'month']).default('auto'),
      tz: z.string().trim().default('UTC').refine(isValidTimezone, 'Invalid IANA timezone'),
      topDoctors: z.coerce.number().int().min(1).max(50).default(10),
    }),
  ),
};
