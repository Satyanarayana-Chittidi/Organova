import { Request, Response, NextFunction } from 'express';
import { verifyToken, AUTH_COOKIE_NAME } from '../utils/jwt';
import { JWTPayload, UserRole } from '../types/auth';

// Extend Express Request interface to include our strongly-typed user session
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authentication Middleware:
 * Inspects incoming requests for a valid JWT token.
 * Checks HTTP-only cookies first, with a fallback to the 'Authorization: Bearer <token>' header.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];

  // Fallback: Check Authorization header for REST clients / mobile apps
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to continue.',
    });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // Injects { userId, email, role } into req for downstream handlers
    next(); // Pass control to the controller
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Session has expired or is invalid. Please log in again.',
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Enforces that only authorized user roles can access a specific route.
 * Usage: authorizeRoles('ADMIN'), authorizeRoles('HOSPITAL')
 */
export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted. Required role(s): [${allowedRoles.join(', ')}].`,
      });
      return;
    }

    next(); // Role matches, proceed!
  };
}
