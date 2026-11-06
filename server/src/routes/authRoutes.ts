import { Router } from 'express';
import {
  register,
  verifyOtp,
  login,
  logout,
  getMe,
} from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// ====================================================================
// AUTHENTICATION ROUTES (/api/auth)
// ====================================================================

// Public Endpoints
router.post('/register', register);     // Step 1: Initiate signup & receive OTP
router.post('/verify-otp', verifyOtp); // Step 2: Submit OTP & activate account
router.post('/login', login);           // Standard password login
router.post('/logout', logout);         // Clear session cookie

// Protected Endpoints (Requires valid login session)
router.get('/me', authenticate, getMe); // Fetch current authenticated user

export default router;
