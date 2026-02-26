import express, { Response } from 'express';
import { User } from '../models/User.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all members (users with role='member')
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // Fetch all users with role='member'
    const users = await User.find({ role: 'member' })
      .select('-password -verificationToken -verificationTokenExpires -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 })
      .lean();

    // Transform users to the format expected by frontend
    const members = users.map((user) => ({
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
      state: user.state,
      city: user.city,
      industry: user.industry,
      bio: user.bio,
      website: user.website,
      linkedin: user.linkedin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    res.json({
      data: {
        members,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get members error:', error);
    res.status(500).json({ error: error.message || 'Failed to get members' });
  }
});

// Get member by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'member' })
      .select('-password -verificationToken -verificationTokenExpires -resetPasswordToken -resetPasswordExpires')
      .lean();

    if (!user) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const member = {
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
      state: user.state,
      city: user.city,
      industry: user.industry,
      bio: user.bio,
      website: user.website,
      linkedin: user.linkedin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      data: {
        member,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get member error:', error);
    res.status(500).json({ error: error.message || 'Failed to get member' });
  }
});

export default router;
