import express, { Response } from 'express';
import { Event } from '../models/Event.js';
import { User } from '../models/User.js';

const router = express.Router();

// Get public statistics for homepage
router.get('/public', async (req, res: Response) => {
  try {
    // Count upcoming events
    const upcomingEventsCount = await Event.countDocuments({
      startDate: { $gte: new Date() },
      status: { $in: ['upcoming', 'ongoing'] },
    });

    // Count approved members
    const activeMembersCount = await User.countDocuments({
      approvalStatus: 'approved',
    });

    // Resource count - placeholder for now (you can create a Resource model later)
    const resourceCount = 0; // Placeholder

    res.json({
      data: {
        upcomingEvents: upcomingEventsCount,
        activeMembers: activeMembersCount,
        resources: resourceCount,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get public statistics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get statistics' });
  }
});

export default router;
