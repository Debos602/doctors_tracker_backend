import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/auth.controller.js';
import { authorize, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, refreshTokenSchema, registerSchema } from '../validators/auth.validator.js';
import { ROLES } from '../constants.js';
import { env } from '../config/env.js';

const router = Router();

const limiter = (limit, message, extra = {}) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    skip: () => env.isTest,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', message },
    ...extra,
  });

const loginLimiter = limiter(10, 'Too many login attempts. Try again in 15 minutes.', { skipSuccessfulRequests: true });
const refreshLimiter = limiter(60, 'Too many refresh attempts. Try again later.');

router.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh', refreshLimiter, validate(refreshTokenSchema), ctrl.refresh);
router.post('/logout', validate(refreshTokenSchema), ctrl.logout);
router.post('/logout-all', protect, ctrl.logoutAll);
router.get('/me', protect, ctrl.me);
router.post('/register', protect, authorize(ROLES.ADMIN), validate(registerSchema), ctrl.register);

export default router;
