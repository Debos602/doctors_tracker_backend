import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function extractAccessToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[env.ACCESS_COOKIE_NAME];
}

/** Accepts the httpOnly access cookie (browser) or an Authorization: Bearer header (API clients). */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = extractAccessToken(req);
  if (!token) throw ApiError.unauthorized();

  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (payload.type !== 'access') throw ApiError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');

  // One indexed lookup so deleted users or changed roles take effect immediately.
  const user = await User.findById(payload.sub).select('name email role').lean();
  if (!user) throw ApiError.unauthorized('User no longer exists', 'TOKEN_INVALID');

  req.user = user;
  next();
});

export const authorize =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(ApiError.forbidden());
