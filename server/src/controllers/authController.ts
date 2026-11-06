import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { AUTH_COOKIE_NAME, cookieOptions } from '../utils/jwt';
import { RegisterDTO, VerifyOtpDTO, LoginDTO } from '../types/auth';

/**
 * Handles Step 1: User Registration
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role }: RegisterDTO = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
      return;
    }

    const result = await authService.registerUser({ email, password, role });

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        ...result.user,
        devOtp: (result as any).devOtp,
      },
    });
  } catch (error) {
    next(error); // Forward to global error handler in app.ts
  }
}

/**
 * Handles Step 2: OTP Verification & Initial Login
 * POST /api/auth/verify-otp
 */
export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, otp }: VerifyOtpDTO = req.body;

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: 'Email and 6-digit OTP code are required.',
      });
      return;
    }

    const result = await authService.verifyOtp({ email, otp });

    // Attach the secure, HTTP-only JWT session cookie to the browser
    res.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Account verified successfully. Logged in.',
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles Standard User Login
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password }: LoginDTO = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
      return;
    }

    const result = await authService.loginUser({ email, password });

    // Attach the secure, HTTP-only JWT session cookie ONLY for non-ADMIN users.
    // For ADMIN accounts, we do NOT attach a domain-wide cookie. This keeps the admin
    // session strictly isolated to Master Control and prevents privilege leakage to public tabs.
    if (result.user.role === 'ADMIN') {
      res.clearCookie(AUTH_COOKIE_NAME, {
        ...cookieOptions,
        maxAge: 0,
      });
    } else {
      res.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);
    }

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles User Logout
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Clear the HTTP-only authentication cookie
    res.clearCookie(AUTH_COOKIE_NAME, {
      ...cookieOptions,
      maxAge: 0,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches Currently Authenticated User Session
 * GET /api/auth/me
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // The userId is injected into req.user by our authenticate middleware
    const currentUser = (req as any).user;

    const userProfile = await authService.getUserProfile(currentUser.userId);

    res.status(200).json({
      success: true,
      data: userProfile,
    });
  } catch (error) {
    next(error);
  }
}
