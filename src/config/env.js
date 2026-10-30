import 'dotenv/config';
import { z } from 'zod';

const duration = z.string().regex(/^\d+[smhd]?$/, 'Use a value like 900, 15m, 12h or 7d');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: duration.default('15m'),
  REFRESH_TOKEN_TTL: duration.default('7d'),
  ACCESS_COOKIE_NAME: z.string().default('dt_access'),
  REFRESH_COOKIE_NAME: z.string().default('dt_refresh'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  ADMIN_NAME: z.string().default('Admin'),
  ADMIN_EMAIL: z.string().email().default('admin@doctortracker.com'),
  ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables (see .env.example):');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigins: parsed.data.CLIENT_URL.split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
});
