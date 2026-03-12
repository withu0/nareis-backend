import express, { Response } from 'express';
import { User } from '../models/User.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { stripe } from '../config/stripe.js';

const router = express.Router();

// Middleware to check if user is admin
const adminMiddleware = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
};

// Apply auth and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Get dashboard statistics
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ membershipStatus: 'active' });
    const pendingUsers = await User.countDocuments({ approvalStatus: 'pending' });
    
    // Count by membership tier
    const tierCounts = await User.aggregate([
      {
        $group: {
          _id: '$membershipTier',
          count: { $sum: 1 },
        },
      },
    ]);

    // Count by role
    const roleCounts = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      data: {
        totalUsers,
        activeUsers,
        pendingUsers,
        tierCounts: tierCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        roleCounts: roleCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get statistics' });
  }
});

// Get all users with optional filters
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { status, role, tier, search } = req.query;
    
    const filter: any = {};
    
    if (status) {
      filter.approvalStatus = status;
    }
    if (role) {
      filter.role = role;
    }
    if (tier) {
      filter.membershipTier = tier;
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { organization: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      data: {
        users: users.map((user) => ({
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
          emailVerified: user.emailVerified,
          profilePictureUrl: user.profilePictureUrl,
          chapterId: user.chapterId,
          interests: user.interests,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message || 'Failed to get users' });
  }
});

// Create new user
router.post('/users', upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      email,
      password,
      fullName,
      firstName,
      lastName,
      phone,
      organization,
      jobTitle,
      role,
      membershipTier,
      membershipStatus,
      approvalStatus,
      onboardingCompleted,
      emailVerified,
    } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      res.status(400).json({ error: 'Email, password, and full name are required' });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    // Get avatar URL if file was uploaded
    let profilePictureUrl: string | undefined;
    if (req.file) {
      // Store relative path instead of full URL for portability
      profilePictureUrl = `/uploads/avatars/${req.file.filename}`;
    }

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      password, // Will be hashed by the User model pre-save hook
      fullName,
      firstName,
      lastName,
      phone,
      organization,
      jobTitle,
      role: role || 'member',
      membershipTier: membershipTier || 'foundation',
      membershipStatus: membershipStatus || 'pending',
      approvalStatus: approvalStatus || 'pending',
      onboardingCompleted: onboardingCompleted === 'true' || onboardingCompleted === true,
      emailVerified: emailVerified === 'true' || emailVerified === true,
      profilePictureUrl,
    });

    await user.save();

    res.status(201).json({
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
          emailVerified: user.emailVerified,
          profilePictureUrl: user.profilePictureUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// Get user by ID
router.get('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

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
          emailVerified: user.emailVerified,
          profilePictureUrl: user.profilePictureUrl,
          chapterId: user.chapterId,
          interests: user.interests,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

// Update user
router.put('/users/:id', upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Admin can update any field except password (use separate endpoint for that)
    const allowedFields = [
      'fullName',
      'firstName',
      'lastName',
      'phone',
      'organization',
      'jobTitle',
      'role',
      'membershipTier',
      'membershipStatus',
      'approvalStatus',
      'onboardingCompleted',
      'emailVerified',
      'profilePictureUrl',
      'chapterId',
      'interests',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // Handle boolean fields that come as strings from FormData
        if (field === 'onboardingCompleted' || field === 'emailVerified') {
          (user as any)[field] = req.body[field] === 'true' || req.body[field] === true;
        } else {
          (user as any)[field] = req.body[field];
        }
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
          role: user.role,
          membershipTier: user.membershipTier,
          approvalStatus: user.approvalStatus,
          profilePictureUrl: user.profilePictureUrl,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Don't allow deleting yourself
    if (user._id.toString() === req.user!._id.toString()) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      data: { message: 'User deleted successfully' },
      error: null,
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// Approve user
router.put('/users/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.approvalStatus = 'approved';
    user.membershipStatus = 'approved';
    await user.save();

    res.json({
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          approvalStatus: user.approvalStatus,
          membershipStatus: user.membershipStatus,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve user' });
  }
});

// Reject user
router.put('/users/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.approvalStatus = 'rejected';
    user.membershipStatus = 'rejected';
    await user.save();

    res.json({
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          approvalStatus: user.approvalStatus,
          membershipStatus: user.membershipStatus,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Reject user error:', error);
    res.status(500).json({ error: error.message || 'Failed to reject user' });
  }
});

// --- Coupon management (Stripe as source of truth) ---

router.get('/coupons', async (_req: AuthRequest, res: Response) => {
  try {
    const coupons = await stripe.coupons.list({ limit: 100 });
    res.json({
      data: coupons.data.map((c) => ({
        id: c.id,
        name: c.name,
        percentOff: c.percent_off,
        amountOff: c.amount_off,
        currency: c.currency,
        duration: c.duration,
        durationInMonths: c.duration_in_months,
        maxRedemptions: c.max_redemptions,
        redeemBy: c.redeem_by,
        timesRedeemed: c.times_redeemed,
        valid: c.valid,
      })),
      error: null,
    });
  } catch (error: any) {
    console.error('List coupons error:', error);
    res.status(500).json({ error: error.message || 'Failed to list coupons' });
  }
});

router.post('/coupons', async (req: AuthRequest, res: Response) => {
  try {
    const { percentOff, amountOff, currency, duration, durationInMonths, name, maxRedemptions, redeemBy } = req.body;
    if ((percentOff == null && amountOff == null) || !duration) {
      res.status(400).json({ error: 'percentOff or amountOff, and duration are required' });
      return;
    }
    const params: any = {
      duration: duration === 'repeating' && durationInMonths ? 'repeating' : duration === 'forever' ? 'forever' : 'once',
    };
    if (percentOff != null) params.percent_off = Math.min(100, Math.max(0, Number(percentOff)));
    if (amountOff != null) {
      params.amount_off = Math.round(Number(amountOff));
      if (currency) params.currency = currency;
    }
    if (duration === 'repeating' && durationInMonths) params.duration_in_months = durationInMonths;
    if (name) params.name = name;
    if (maxRedemptions != null) params.max_redemptions = Number(maxRedemptions);
    if (redeemBy != null) params.redeem_by = Math.floor(Number(new Date(redeemBy).getTime() / 1000));
    const coupon = await stripe.coupons.create(params);
    res.json({
      data: {
        id: coupon.id,
        name: coupon.name,
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off,
        currency: coupon.currency,
        duration: coupon.duration,
        valid: coupon.valid,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: error.message || 'Failed to create coupon' });
  }
});

router.post('/coupons/:couponId/promotion-codes', async (req: AuthRequest, res: Response) => {
  try {
    const { couponId } = req.params;
    const { code, maxRedemptions, expiresAt } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ error: 'code is required' });
      return;
    }
    const params: any = { coupon: couponId, code: code.trim() };
    if (maxRedemptions != null) params.max_redemptions = Number(maxRedemptions);
    if (expiresAt != null) params.expires_at = Math.floor(Number(new Date(expiresAt).getTime() / 1000));
    const promotionCode = await stripe.promotionCodes.create(params);
    res.json({
      data: {
        id: promotionCode.id,
        code: promotionCode.code,
        coupon: promotionCode.coupon,
        active: promotionCode.active,
        expiresAt: promotionCode.expires_at,
        maxRedemptions: promotionCode.max_redemptions,
        timesRedeemed: promotionCode.times_redeemed,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Create promotion code error:', error);
    res.status(500).json({ error: error.message || 'Failed to create promotion code' });
  }
});

router.get('/promotion-codes', async (req: AuthRequest, res: Response) => {
  try {
    const { coupon: couponId } = req.query;
    const listParams: any = { limit: 100 };
    if (couponId && typeof couponId === 'string') listParams.coupon = couponId;
    const promotionCodes = await stripe.promotionCodes.list(listParams);
    res.json({
      data: promotionCodes.data.map((p) => ({
        id: p.id,
        code: p.code,
        coupon: typeof p.coupon === 'object' ? (p.coupon as any).id : p.coupon,
        active: p.active,
        expiresAt: p.expires_at,
        maxRedemptions: p.max_redemptions,
        timesRedeemed: p.times_redeemed,
      })),
      error: null,
    });
  } catch (error: any) {
    console.error('List promotion codes error:', error);
    res.status(500).json({ error: error.message || 'Failed to list promotion codes' });
  }
});

router.patch('/promotion-codes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const promotionCode = await stripe.promotionCodes.update(id, { active: false });
    res.json({
      data: {
        id: promotionCode.id,
        code: promotionCode.code,
        active: promotionCode.active,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Deactivate promotion code error:', error);
    res.status(500).json({ error: error.message || 'Failed to deactivate promotion code' });
  }
});

export default router;
