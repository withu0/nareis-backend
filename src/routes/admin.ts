import express, { Response } from 'express';
import { User } from '../models/User.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

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

export default router;
