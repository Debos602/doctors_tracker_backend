import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { dashboardSummarySchema } from '../validators/dashboard.validator.js';

const router = Router();

router.get('/summary', protect, validate(dashboardSummarySchema), ctrl.summary);

export default router;
