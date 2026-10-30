const UNITS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** "30m" → 1_800_000. A bare number is seconds (same as jsonwebtoken). */
export function durationToMs(value) {
  const match = /^(\d+)([smhd])?$/.exec(String(value).trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  return Number(match[1]) * UNITS[match[2] ?? 's'];
}
