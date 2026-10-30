import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

const baseCookie = {
  httpOnly: true,
  secure: env.isProd,
  // Frontend and API live on different domains in production → cross-site cookies need "none".
  sameSite: env.isProd ? 'none' : 'lax',
};
const accessCookie = { ...baseCookie, path: '/' };
// The refresh cookie is only ever sent to the auth routes, never with ordinary API calls.
const refreshCookie = { ...baseCookie, path: '/api/auth' };

const requestMeta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 200) });

// Browsers use the httpOnly cookie; API clients (Postman, mobile) can send it in the body.
const readRefreshToken = (req) => req.cookies?.[env.REFRESH_COOKIE_NAME] ?? req.valid?.body?.refreshToken;

function setSessionCookies(res, session) {
  res.cookie(env.ACCESS_COOKIE_NAME, session.accessToken, { ...accessCookie, maxAge: authService.ACCESS_TTL_MS });
  res.cookie(env.REFRESH_COOKIE_NAME, session.refreshToken, { ...refreshCookie, maxAge: authService.REFRESH_TTL_MS });
}

function clearSessionCookies(res) {
  res.clearCookie(env.ACCESS_COOKIE_NAME, accessCookie);
  res.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookie);
}

export const login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.valid.body, requestMeta(req));
  setSessionCookies(res, session);
  sendSuccess(res, session, { message: 'Logged in successfully' });
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const session = await authService.refreshSession(readRefreshToken(req), requestMeta(req));
    setSessionCookies(res, session);
    sendSuccess(res, session, { message: 'Session refreshed' });
  } catch (err) {
    // A dead refresh token means the session is over — drop the stale cookies too.
    if (err.statusCode === 401) clearSessionCookies(res);
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(readRefreshToken(req));
  clearSessionCookies(res);
  sendSuccess(res, null, { message: 'Logged out' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  const result = await authService.logoutAll(req.user._id);
  clearSessionCookies(res);
  sendSuccess(res, result, { message: 'Logged out from all devices' });
});

export const me = (req, res) => sendSuccess(res, req.user);

export const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.valid.body);
  sendSuccess(res, user, { status: 201, message: 'User created' });
});
