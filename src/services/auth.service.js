import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { RefreshToken, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { durationToMs } from '../utils/duration.js';

export const ACCESS_TTL_MS = durationToMs(env.ACCESS_TOKEN_TTL);
export const REFRESH_TTL_MS = durationToMs(env.REFRESH_TOKEN_TTL);

/**
 * Two tabs refreshing at the same moment would otherwise look like token theft.
 * A token rotated less than this long ago gets a 409 (retry) instead of revoking the session.
 */
const ROTATION_GRACE_MS = 10_000;

// Compared against when the email doesn't exist, so response time doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', 12);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, type: 'access' }, env.JWT_SECRET, {
    expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
    algorithm: 'HS256',
  });
}

/** Opaque random token (not a JWT): it is only ever checked against the database. */
async function issueRefreshToken(userId, { family = crypto.randomUUID(), meta = {} } = {}) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(token),
    family,
    expiresAt,
    createdByIp: meta.ip,
    userAgent: meta.userAgent,
  });

  return { token, expiresAt };
}

function buildSession(user, refresh) {
  return {
    user,
    accessToken: signAccessToken(user),
    accessTokenExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

export async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+password');
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

  if (!user || !valid) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  const refresh = await issueRefreshToken(user._id, { meta });

  return buildSession(user.toJSON(), refresh);
}

/**
 * Refresh-token rotation:
 *  - each refresh token works once; using it returns a new access + refresh pair
 *  - presenting an already-used token means it was copied → revoke the whole login (family)
 */
export async function refreshSession(rawToken, meta) {
  if (!rawToken) throw ApiError.unauthorized('Refresh token missing', 'REFRESH_TOKEN_MISSING');

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  // Atomically "claim" the token so two concurrent requests can't both rotate it.
  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, revokedReason: 'rotated' } },
  ).lean();

  if (!current) {
    const existing = await RefreshToken.findOne({ tokenHash }).lean();

    if (!existing || existing.expiresAt <= now || existing.revokedReason !== 'rotated') {
      throw ApiError.unauthorized('Session expired, please log in again', 'REFRESH_TOKEN_INVALID');
    }

    if (now - existing.revokedAt < ROTATION_GRACE_MS) {
      throw ApiError.conflict('Token was just refreshed by another request — retry', 'REFRESH_IN_PROGRESS');
    }

    await RefreshToken.updateMany(
      { family: existing.family, revokedAt: null },
      { $set: { revokedAt: now, revokedReason: 'reuse_detected' } },
    );
    throw ApiError.unauthorized(
      'This session was signed out for security reasons, please log in again',
      'REFRESH_TOKEN_REUSED',
    );
  }

  const user = await User.findById(current.user).select('-__v').lean();
  if (!user) throw ApiError.unauthorized('User no longer exists', 'REFRESH_TOKEN_INVALID');

  const refresh = await issueRefreshToken(user._id, { family: current.family, meta });
  await RefreshToken.updateOne({ _id: current._id }, { $set: { replacedByHash: hashToken(refresh.token) } });

  return buildSession(user, refresh);
}

/** Revokes this device's refresh token (the access token simply expires). */
export async function logout(rawToken) {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
  );
}

/** Signs the user out everywhere. */
export async function logoutAll(userId) {
  const { modifiedCount } = await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'logout_all' } },
  );
  return { revokedSessions: modifiedCount };
}

export async function registerUser(data) {
  if (await User.exists({ email: data.email })) {
    throw ApiError.conflict('A user with this email already exists', 'DUPLICATE');
  }
  const user = await User.create(data);
  return user.toJSON();
}
