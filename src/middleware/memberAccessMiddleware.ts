import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware.js';

/** Mirrors frontend ProtectedRoute: onboarding, approval, paid membership. Admins bypass. */
export const requireActiveMember = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (user.role === 'admin') {
    next();
    return;
  }

  if (!user.onboardingCompleted) {
    res.status(403).json({ error: 'Complete onboarding to access this feature' });
    return;
  }

  if (user.approvalStatus !== 'approved') {
    res.status(403).json({ error: 'Account not approved' });
    return;
  }

  const hasMemberAccess =
    (user.membershipStatus === 'active' || user.membershipStatus === 'canceling') &&
    (!user.membershipExpiresAt || new Date(user.membershipExpiresAt) > new Date());

  if (!hasMemberAccess) {
    res.status(403).json({ error: 'Active membership required' });
    return;
  }

  next();
};
