import crypto from 'crypto';
import redis from '../config/redis';
import { hashPassword, comparePassword } from '../utils/hash';
import { signToken } from '../utils/jwt';
import { sendOtpEmail } from './emailService';
import {
  findUserByEmail,
  findUserById,
  createLocalUser,
  markUserAsVerified,
} from '../models/userModel';
import { findHubByUserId } from '../models/hubModel';
import {
  RegisterDTO,
  VerifyOtpDTO,
  LoginDTO,
  AuthUserResponse,
  User,
  UserRole,
} from '../types/auth';

// Data structure for registration awaiting OTP verification
interface PendingRegistration {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  otp: string;
  expiresAt: number;
}

// In-memory fallback store for local development if Redis service is not running
const devPendingRegistrations = new Map<string, PendingRegistration>();

// Helper to sanitize a User entity into a safe client response (removes password_hash)
function toAuthResponse(user: User): AuthUserResponse {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    auth_provider: user.auth_provider,
    is_verified: user.is_verified,
    avatar_url: user.avatar_url || null,
  };
}

/**
 * Step 1: Initiates registration for a new user with email & password.
 * Hashes password, generates a 6-digit OTP, and stores pending details
 * temporarily in Redis / memory for 5 minutes (300 seconds).
 * NOTE: The user is NOT saved to the database until OTP is successfully verified!
 */
export async function registerUser(dto: RegisterDTO): Promise<{
  message: string;
  user: AuthUserResponse;
  devOtp?: string;
}> {
  const normalizedEmail = dto.email.toLowerCase().trim();

  // 1. Verify email uniqueness against database
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    const error: any = new Error('An account with this email already exists.');
    error.statusCode = 409; // Conflict
    throw error;
  }

  // 2. Hash password & generate unique user ID
  const passwordHash = await hashPassword(dto.password);
  const userId = crypto.randomUUID();

  // 3. Generate a 6-digit OTP code (e.g. "849201")
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 4. Store pending registration in Redis with a 5-minute TTL (300 seconds)
  const pendingData: PendingRegistration = {
    id: userId,
    email: normalizedEmail,
    passwordHash,
    role: dto.role || 'USER',
    otp,
    expiresAt: Date.now() + 300 * 1000,
  };

  try {
    await redis.setex(`pending_reg:${normalizedEmail}`, 300, JSON.stringify(pendingData));
  } catch (redisError) {
    console.warn('[REDIS] Cache offline. Using memory fallback store for pending registration.');
  }
  devPendingRegistrations.set(normalizedEmail, pendingData);

  // 5. Send OTP email via configured SMTP/API (with non-blocking error resilience)
  let emailDelivered = false;
  try {
    const mailResult = await sendOtpEmail(normalizedEmail, otp);
    emailDelivered = !!mailResult.delivered;
  } catch (emailErr: any) {
    console.warn('[EMAIL] Non-fatal email dispatch notice:', emailErr.message);
  }

  return {
    message: emailDelivered
      ? 'Registration initiated. Please verify the 6-digit OTP sent to your email.'
      : 'Registration initiated. Verification code sent (or use demo code shown below).',
    user: {
      id: userId,
      email: normalizedEmail,
      role: dto.role || 'USER',
      auth_provider: 'LOCAL',
      is_verified: false,
      avatar_url: null,
    },
    devOtp: (!emailDelivered || process.env.NODE_ENV !== 'production') ? otp : undefined,
  };
}

/**
 * Step 2: Verifies the 6-digit OTP.
 * ONLY upon successful OTP verification is the user persisted to the MySQL database.
 * Once saved, issues a signed JWT authentication session token.
 */
export async function verifyOtp(dto: VerifyOtpDTO): Promise<{
  token: string;
  user: AuthUserResponse;
}> {
  const normalizedEmail = dto.email.toLowerCase().trim();

  // 1. Fetch pending registration from Redis (with local memory fallback)
  let pendingData: PendingRegistration | null = null;
  try {
    const raw = await redis.get(`pending_reg:${normalizedEmail}`);
    if (raw) {
      pendingData = JSON.parse(raw);
    }
  } catch (err) {
    // Redis offline in local dev - handled smoothly by memory store fallback
  }

  // Check in-memory fallback if Redis was offline
  if (!pendingData) {
    const memoryRecord = devPendingRegistrations.get(normalizedEmail);
    if (memoryRecord && memoryRecord.expiresAt > Date.now()) {
      pendingData = memoryRecord;
    }
  }

  // 2. Validate pending session existence
  if (!pendingData) {
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      const error: any = new Error('Account is already verified. Please sign in.');
      error.statusCode = 400;
      throw error;
    }
    const error: any = new Error('Registration session expired or invalid. Please sign up again.');
    error.statusCode = 400;
    throw error;
  }

  // 3. Verify OTP code match
  if (pendingData.otp !== dto.otp.trim()) {
    const error: any = new Error('Invalid or expired OTP verification code.');
    error.statusCode = 400;
    throw error;
  }

  // 4. SAVE TO DATABASE: Create the verified user in MySQL only now!
  const user = await createLocalUser({
    id: pendingData.id,
    email: pendingData.email,
    passwordHash: pendingData.passwordHash,
    role: pendingData.role,
    isVerified: true,
  });

  console.log(`[AUTH] ✓ 6-digit OTP successfully verified for ${normalizedEmail}. User saved to database as verified.`);

  // 5. Remove pending registration data so it cannot be reused
  devPendingRegistrations.delete(normalizedEmail);
  try {
    await redis.del(`pending_reg:${normalizedEmail}`);
  } catch (err) {}

  // 6. Sign JWT session token
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: toAuthResponse(user),
  };
}

/**
 * Step 3: Logs in a user using email & password.
 * Checks password match, verified status, and active status, returning a fresh JWT token.
 */
export async function loginUser(dto: LoginDTO): Promise<{
  token: string;
  user: AuthUserResponse;
}> {
  const normalizedEmail = dto.email.toLowerCase().trim();

  // 1. Look up user (supports demo account and developer email aliases)
  let user = await findUserByEmail(normalizedEmail);
  if (!user && (
    normalizedEmail === 'chsatyanarayana1@gmail.com' ||
    normalizedEmail === 'chsatyanarayana3936@gmail.com' ||
    normalizedEmail === 'chittidisatyanarayana2@gmail.com'
  )) {
    user = await findUserByEmail('phantomcapacitor@gmail.com');
  }
  if (!user) {
    console.warn(`[AUTH] Login attempt failed: Email not found (${normalizedEmail})`);
    const error: any = new Error('Invalid email or password.');
    error.statusCode = 401; // Unauthorized
    throw error;
  }

  // 2. If user registered via Google, direct them to use Google Login
  if (user.auth_provider === 'GOOGLE' || !user.password_hash) {
    const error: any = new Error('This account was created via Google. Please sign in with Google.');
    error.statusCode = 400;
    throw error;
  }

  // 3. Verify password
  const isMatch = await comparePassword(dto.password, user.password_hash);
  if (!isMatch) {
    const error: any = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  // 4. Ensure account is verified
  if (!user.is_verified) {
    const error: any = new Error('Account is not verified. Please complete email OTP verification before signing in.');
    error.statusCode = 403;
    throw error;
  }

  // 5. Ensure account is active
  if (!user.is_active) {
    const error: any = new Error('This account has been deactivated. Please contact support.');
    error.statusCode = 403;
    throw error;
  }

  // 5.5 If user is an institutional medical facility, ensure it has been approved by Admin
  if (user.role === 'HOSPITAL') {
    const hub = await findHubByUserId(user.id);
    if (hub) {
      if (hub.verification_status === 'PENDING_APPROVAL') {
        const error: any = new Error("Waiting for admin's approval. Your facility registration is currently under review.");
        error.statusCode = 403;
        throw error;
      }
      if (hub.verification_status === 'REJECTED') {
        const error: any = new Error("Registration not approved. Your facility dossier was declined by administration.");
        error.statusCode = 403;
        throw error;
      }
      if (hub.verification_status === 'SUSPENDED') {
        const error: any = new Error("Facility account suspended. Please contact platform administration.");
        error.statusCode = 403;
        throw error;
      }
    }
  }

  // 6. Issue JWT token
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: toAuthResponse(user),
  };
}

/**
 * Fetches current logged-in user profile by ID
 */
export async function getUserProfile(userId: string): Promise<AuthUserResponse> {
  const user = await findUserById(userId);
  if (!user) {
    const error: any = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }
  return toAuthResponse(user);
}
