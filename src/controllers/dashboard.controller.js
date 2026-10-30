import * as dashboardService from '../services/dashboard.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const summary = asyncHandler(async (req, res) => {
  sendSuccess(res, await dashboardService.getSummary(req.valid.query));
});
