// ====================================================================
// AUTHENTICATION & USER TYPES
// ====================================================================

export type UserRole = 'USER' | 'HOSPITAL' | 'ADMIN';
export type AuthProvider = 'LOCAL' | 'GOOGLE';

// --------------------------------------------------------------------
// 1. DATABASE ENTITY
// Represents the full user row as stored in MySQL
// --------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
  auth_provider: AuthProvider;
  google_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string | null;
  created_at: Date;
  updated_at: Date;
}

// --------------------------------------------------------------------
// 2. DATA TRANSFER OBJECTS (DTOs)
// Incoming request payloads sent from the frontend / client
// --------------------------------------------------------------------

// Payload sent when a user signs up with email & password
export interface RegisterDTO {
  email: string;
  password: string;
  role?: UserRole; // Defaults to 'USER' if omitted
}

// Payload sent when submitting the 6-digit OTP verification code
export interface VerifyOtpDTO {
  email: string;
  otp: string;
}

// Payload sent when logging in with email & password
export interface LoginDTO {
  email: string;
  password: string;
}

// Payload sent when authenticating via Google One-Tap / OAuth
export interface GoogleAuthDTO {
  credential: string; // The signed Google ID token
}

// --------------------------------------------------------------------
// 3. SESSION & TOKEN PAYLOADS
// --------------------------------------------------------------------

// Data encoded inside the signed JWT cookie
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Safe user object returned in HTTP responses (password_hash is stripped!)
export interface AuthUserResponse {
  id: string;
  email: string;
  role: UserRole;
  auth_provider: AuthProvider;
  is_verified: boolean;
  avatar_url?: string | null;
}
