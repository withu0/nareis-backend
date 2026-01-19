import express, { Request, Response } from 'express';
import { Event } from '../models/Event';
import { EventRegistration } from '../models/EventRegistration';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Middleware to check if user is admin
const adminMiddleware = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
};

// Get all events (public/authenticated)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, eventType, upcoming } = req.query;
    
    const filter: any = {};
    
    if (status) {
      filter.status = status;
    }
    if (eventType) {
      filter.eventType = eventType;
    }
    if (upcoming === 'true') {
      filter.startDate = { $gte: new Date() };
      filter.status = { $in: ['upcoming', 'ongoing'] };
    }

    const events = await Event.find(filter)
      .populate('organizerId', 'fullName email')
      .sort({ startDate: 1 })
      .lean();

    // Get registration counts for each event
    const eventIds = events.map((e) => e._id);
    const registrations = await EventRegistration.aggregate([
      { $match: { eventId: { $in: eventIds }, status: 'registered' } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } },
    ]);

    const regCountMap: Record<string, number> = {};
    registrations.forEach((reg) => {
      regCountMap[reg._id.toString()] = reg.count;
    });

    res.json({
      data: {
        events: events.map((event) => ({
          id: event._id.toString(),
          title: event.title,
          description: event.description,
          eventType: event.eventType,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          virtualLink: event.virtualLink,
          isVirtual: event.isVirtual,
          organizerId: event.organizerId,
          chapterId: event.chapterId,
          maxAttendees: event.maxAttendees,
          registrationDeadline: event.registrationDeadline,
          status: event.status,
          imageUrl: event.imageUrl,
          registeredCount: regCountMap[event._id.toString()] || 0,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        })),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get events error:', error);
    res.status(500).json({ error: error.message || 'Failed to get events' });
  }
});

// Get event by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizerId', 'fullName email');
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Get registration count
    const registeredCount = await EventRegistration.countDocuments({
      eventId: event._id,
      status: 'registered',
    });

    res.json({
      data: {
        event: {
          id: event._id.toString(),
          title: event.title,
          description: event.description,
          eventType: event.eventType,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          virtualLink: event.virtualLink,
          isVirtual: event.isVirtual,
          organizerId: event.organizerId,
          chapterId: event.chapterId,
          maxAttendees: event.maxAttendees,
          registrationDeadline: event.registrationDeadline,
          status: event.status,
          imageUrl: event.imageUrl,
          registeredCount,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get event error:', error);
    res.status(500).json({ error: error.message || 'Failed to get event' });
  }
});

// Create event (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      eventType,
      startDate,
      endDate,
      location,
      virtualLink,
      isVirtual,
      chapterId,
      maxAttendees,
      registrationDeadline,
      status,
      imageUrl,
    } = req.body;

    if (!title || !description || !startDate || !location) {
      res.status(400).json({ error: 'Title, description, start date, and location are required' });
      return;
    }

    const event = new Event({
      title,
      description,
      eventType: eventType || 'Networking',
      startDate,
      endDate,
      location,
      virtualLink,
      isVirtual: isVirtual || false,
      organizerId: req.user!._id,
      chapterId,
      maxAttendees,
      registrationDeadline,
      status: status || 'upcoming',
      imageUrl,
    });

    await event.save();

    res.status(201).json({
      data: {
        event: {
          id: event._id.toString(),
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          status: event.status,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Create event error:', error);
    res.status(500).json({ error: error.message || 'Failed to create event' });
  }
});

// Update event (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const allowedFields = [
      'title',
      'description',
      'eventType',
      'startDate',
      'endDate',
      'location',
      'virtualLink',
      'isVirtual',
      'chapterId',
      'maxAttendees',
      'registrationDeadline',
      'status',
      'imageUrl',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (event as any)[field] = req.body[field];
      }
    });

    await event.save();

    res.json({
      data: {
        event: {
          id: event._id.toString(),
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          status: event.status,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Update event error:', error);
    res.status(500).json({ error: error.message || 'Failed to update event' });
  }
});

// Delete event (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Delete all registrations for this event
    await EventRegistration.deleteMany({ eventId: event._id });
    
    // Delete event
    await Event.findByIdAndDelete(req.params.id);

    res.json({
      data: { message: 'Event and all registrations deleted successfully' },
      error: null,
    });
  } catch (error: any) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete event' });
  }
});

// Register for event (authenticated users)
router.post('/:id/register', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Check if event is open for registration
    if (event.status === 'completed' || event.status === 'cancelled') {
      res.status(400).json({ error: 'Event is not open for registration' });
      return;
    }

    // Check registration deadline
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      res.status(400).json({ error: 'Registration deadline has passed' });
      return;
    }

    // Check if already registered
    const existingRegistration = await EventRegistration.findOne({
      eventId: event._id,
      userId: req.user!._id,
    });

    if (existingRegistration) {
      if (existingRegistration.status === 'cancelled') {
        // Reactivate registration
        existingRegistration.status = 'registered';
        existingRegistration.registrationDate = new Date();
        await existingRegistration.save();
        
        res.json({
          data: { message: 'Registration reactivated successfully' },
          error: null,
        });
        return;
      } else {
        res.status(400).json({ error: 'Already registered for this event' });
        return;
      }
    }

    // Check max attendees
    if (event.maxAttendees) {
      const currentRegistrations = await EventRegistration.countDocuments({
        eventId: event._id,
        status: 'registered',
      });

      if (currentRegistrations >= event.maxAttendees) {
        res.status(400).json({ error: 'Event is full' });
        return;
      }
    }

    // Create registration
    const registration = new EventRegistration({
      eventId: event._id,
      userId: req.user!._id,
    });

    await registration.save();

    res.status(201).json({
      data: { message: 'Successfully registered for event' },
      error: null,
    });
  } catch (error: any) {
    console.error('Register for event error:', error);
    res.status(500).json({ error: error.message || 'Failed to register for event' });
  }
});

// Cancel registration (authenticated users)
router.delete('/:id/register', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const registration = await EventRegistration.findOne({
      eventId: req.params.id,
      userId: req.user!._id,
      status: 'registered',
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    registration.status = 'cancelled';
    await registration.save();

    res.json({
      data: { message: 'Registration cancelled successfully' },
      error: null,
    });
  } catch (error: any) {
    console.error('Cancel registration error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel registration' });
  }
});

// Check registration status (authenticated users)
router.get('/:id/my-registration', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const registration = await EventRegistration.findOne({
      eventId: req.params.id,
      userId: req.user!._id,
    });

    res.json({
      data: {
        registered: registration ? registration.status === 'registered' : false,
        status: registration?.status || null,
        registrationDate: registration?.registrationDate || null,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Check registration error:', error);
    res.status(500).json({ error: error.message || 'Failed to check registration' });
  }
});

// Get event registrations (admin only)
router.get('/:id/registrations', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const registrations = await EventRegistration.find({ eventId: req.params.id })
      .populate('userId', 'fullName email phone organization')
      .sort({ registrationDate: -1 })
      .lean();

    res.json({
      data: {
        registrations: registrations.map((reg) => ({
          id: reg._id.toString(),
          user: reg.userId,
          status: reg.status,
          registrationDate: reg.registrationDate,
          createdAt: reg.createdAt,
        })),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: error.message || 'Failed to get registrations' });
  }
});

export default router;
