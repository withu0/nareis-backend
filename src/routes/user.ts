import express, { Response } from 'express';
import { User } from '../models/User.js';
import { PaymentHistory } from '../models/PaymentHistory.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { stripe } from '../config/stripe.js';

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
router.put('/profile', authMiddleware, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
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

    // If a new avatar was uploaded, update the URL
    if (req.file) {
      // Store relative path instead of full URL for portability
      user.profilePictureUrl = `/uploads/avatars/${req.file.filename}`;
    }

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
        membershipExpiresAt: user.membershipExpiresAt,
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

// Request downgrade: update user's membership tier (takes effect immediately for one-time membership)
router.put('/subscription', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { tier } = req.body;
    const validTiers = ['foundation', 'growth', 'stakeholder', 'professional', 'enterprise', 'founding'];
    if (!tier || !validTiers.includes(tier)) {
      res.status(400).json({ error: 'Valid tier is required' });
      return;
    }
    user.membershipTier = tier;
    await user.save();
    res.json({
      data: { membershipTier: user.membershipTier },
      error: null,
    });
  } catch (error: any) {
    console.error('Request downgrade error:', error);
    res.status(500).json({ error: error.message || 'Failed to update subscription' });
  }
});

// Cancel subscription (set cancel_at_period_end in Stripe; access until membershipExpiresAt)
router.post('/subscription/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.stripeSubscriptionId) {
      res.status(400).json({ error: 'No active subscription' });
      return;
    }
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
    user.membershipStatus = 'canceling';
    await user.save();
    res.json({
      data: { membershipStatus: user.membershipStatus },
      error: null,
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

// Reactivate subscription (clear cancel_at_period_end in Stripe, set active)
router.post('/subscription/reactivate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.stripeSubscriptionId) {
      res.status(400).json({ error: 'No active subscription' });
      return;
    }
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: false });
    user.membershipStatus = 'active';
    await user.save();
    res.json({
      data: { membershipStatus: user.membershipStatus },
      error: null,
    });
  } catch (error: any) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ error: error.message || 'Failed to reactivate subscription' });
  }
});

export default router;
