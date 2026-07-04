import { Response } from 'express';
import { config } from '../config/index';

const ACCESS_COOKIE = 'sr_access_token';
const REFRESH_COOKIE = 'sr_refresh_token';

const isProduction = config.env === 'production';

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: maxAgeMs,
    path: '/',
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export function getAccessTokenFromCookies(cookies: Record<string, string | undefined>): string | undefined {
  return cookies[ACCESS_COOKIE];
}

export function getRefreshTokenFromCookies(cookies: Record<string, string | undefined>): string | undefined {
  return cookies[REFRESH_COOKIE];
}
