import jwt from 'jsonwebtoken';
import { CookieOptions } from 'express';
import { JWTPayload } from '../types/auth';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_organ_donation_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Standard cookie key name for authentication across the platform
export const AUTH_COOKIE_NAME = 'auth_token';

/**
 * Signs a new JSON Web Token containing the user's identity claims.
 * @param payload - Minimal user data (userId, email, role)
 * @returns A cryptographically signed JWT string
 */
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

/**
 * Verifies and decodes an incoming JWT token string.
 * @param token - The raw JWT extracted from cookies
 * @returns The decoded JWTPayload
 * @throws Error if the token is forged, tampered with, or expired
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/**
 * Standard cookie configuration for storing JWTs securely in the browser.
 * - httpOnly: Blocks client-side JavaScript from reading the cookie (prevents XSS attacks).
 * - secure: Only sent over HTTPS in production.
 * - sameSite: Protects against Cross-Site Request Forgery (CSRF).
 */
export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/',
};
