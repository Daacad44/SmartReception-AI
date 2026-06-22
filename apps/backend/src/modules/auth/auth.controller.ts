import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  resendOtpSchema,
  twoFactorVerifySchema,
} from '@smartreception/shared';
import { setAuthCookies, clearAuthCookies, getRefreshTokenFromCookies } from '../../core/auth-cookies';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.register(input);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = loginSchema.parse(req.body);
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
      const result = await authService.login(input, ipAddress);
      if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
        res.json({ success: true, data: result });
        return;
      }
      const tokens = result as { accessToken: string; refreshToken: string };
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const { tempToken, code } = twoFactorVerifySchema.parse(req.body);
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
      const result = await authService.verifyTwoFactorLogin(tempToken, code, ipAddress);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code } = verifyOtpSchema.parse(req.body);
      const result = await authService.verifyOtp(email, code);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async resendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = resendOtpSchema.parse(req.body);
      const result = await authService.resendOtp(email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const bodyToken = req.body?.refreshToken as string | undefined;
      const cookieToken = getRefreshTokenFromCookies(req.cookies as Record<string, string | undefined>);
      const refreshToken = bodyToken || cookieToken;
      if (!refreshToken) {
        res.status(401).json({ success: false, error: 'No refresh token provided' });
        return;
      }
      const tokens = await authService.refresh(refreshToken);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ success: true, data: tokens });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const bodyToken = req.body?.refreshToken as string | undefined;
      const cookieToken = getRefreshTokenFromCookies(req.cookies as Record<string, string | undefined>);
      const refreshToken = bodyToken || cookieToken;
      await authService.logout(refreshToken, req.user?.userId);
      clearAuthCookies(res);
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await authService.forgotPassword(email);
      res.json({ success: true, message: 'If the email exists, a reset code has been sent' });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code, password } = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(email, code, password);
      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await authService.getProfile(req.user!.userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async switchBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.body;
      const tokens = await authService.switchBusiness(req.user!.userId, businessId);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json({ success: true, data: tokens });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
