import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

function normalize(err) {
  if (err instanceof ApiError) {
    return { status: err.statusCode, message: err.message, errors: err.errors, code: err.code };
  }
  if (err instanceof ZodError) {
    return {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: err.issues.map((i) => ({ field: i.path.join('.') || null, message: i.message })),
    };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return {
      status: 422,
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, message: `Invalid value for "${err.path}"` };
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? err.keyPattern ?? {})[0] ?? 'field';
    const message = `A record with this ${field} already exists`;
    return { status: 409, code: 'DUPLICATE', message, errors: [{ field, message }] };
  }
  if (err instanceof jwt.TokenExpiredError) {
    // The client should call POST /api/auth/refresh and retry when it sees this code.
    return { status: 401, code: 'TOKEN_EXPIRED', message: 'Access token expired' };
  }
  if (err instanceof jwt.JsonWebTokenError) {
    return { status: 401, code: 'TOKEN_INVALID', message: 'Invalid authentication token' };
  }
  if (err?.type === 'entity.parse.failed') {
    return { status: 400, message: 'Malformed JSON body' };
  }
  if (err?.type === 'entity.too.large') {
    return { status: 413, message: 'Request body too large' };
  }
  return { status: 500, message: 'Internal server error' };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const { status, message, errors, code } = normalize(err);

  if (status >= 500) console.error(`💥 ${req.method} ${req.originalUrl}`, err);

  res.status(status).json({
    success: false,
    message,
    ...(code && { code }),
    ...(errors && { errors }),
    ...(status >= 500 && !env.isProd && { stack: err.stack }),
  });
}
