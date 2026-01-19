import express, { Response } from 'express';
import { User } from '../models/User';
import { PaymentHistory } from '../models/PaymentHistory';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Get user profile
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    res.json({
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          organization: user.organization,
          jobTitle: user.jobTitle,
          role: user.role,
          membershipTier: user.membershipTier,
          membershipStatus: user.membershipStatus,
          approvalStatus: user.approvalStatus,
          onboardingCompleted: user.onboardingCompleted,
          membershipExpiresAt: user.membershipExpiresAt,
          profilePictureUrl: user.profilePictureUrl,
          chapterId: user.chapterId,
          interests: user.interests,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const updates = req.body;

    // Allowed fields to update
    const allowedFields = [
      'fullName',
      'firstName',
      'lastName',
      'phone',
      'organization',
      'jobTitle',
      'profilePictureUrl',
      'chapterId',
      'interests',
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        (user as any)[field] = updates[field];
      }
    });

    await user.save();

    res.json({
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          organization: user.organization,
          jobTitle: user.jobTitle,
          profilePictureUrl: user.profilePictureUrl,
          chapterId: user.chapterId,
          interests: user.interests,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

// Get subscription details
router.get('/subscription', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    const paymentHistory = await PaymentHistory.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      data: {
        membershipStatus: user.membershipStatus,
        membershipTier: user.membershipTier,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        paymentHistory: paymentHistory.map((payment) => ({
          id: payment._id.toString(),
          amount: payment.amount,
          status: payment.status,
          invoiceUrl: payment.invoiceUrl,
          createdAt: payment.createdAt,
        })),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: error.message || 'Failed to get subscription' });
  }
});

export default router;
