import { z } from 'zod';
import { ROLES } from '../constants.js';
import { email } from './common.js';

export const loginSchema = {
  body: z.object({
    email,
    password: z.string().min(1, 'Password is required').max(128),
  }),
};

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(/[a-z]/, 'Password needs a lowercase letter')
      .regex(/[A-Z]/, 'Password needs an uppercase letter')
      .regex(/\d/, 'Password needs a number'),
    role: z.enum(Object.values(ROLES)).default(ROLES.STAFF),
  }),
};

/** Body is optional: browsers send the refresh token as an httpOnly cookie instead. */
export const refreshTokenSchema = {
  body: z.object({
    refreshToken: z.string().trim().min(20).max(200).optional(),
  }),
};
