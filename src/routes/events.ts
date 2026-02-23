import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { EventRegistration } from '../models/EventRegistration.js';
import { EventWaitlist } from '../models/EventWaitlist.js';
import { EventFeedback } from '../models/EventFeedback.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { WaitlistService } from '../services/waitlistService.js';
import { EventPaymentService } from '../services/eventPaymentService.js';
import { uploadEventImage } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Middleware to check if user is admin
const adminMiddleware = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
};

// Helper function to automatically calculate event status based on dates
const calculateEventStatus = (event: any): string => {
  // Never change cancelled events
  if (event.status === 'cancelled') {
    return 'cancelled';
  }

  const now = new Date();
  const startDate = new Date(event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

  if (now < startDate) {
    return 'upcoming';
  } else if (now >= startDate && now <= endDate) {
    return 'ongoing';
  } else if (now > endDate) {
    return 'completed';
  }

  return event.status || 'upcoming';
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
        events: events.map((event) => {
          // Calculate automatic status based on dates
          const autoStatus = calculateEventStatus(event);
          
          return {
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
            status: autoStatus, // ✅ Automatically calculated based on dates
            imageUrl: event.imageUrl,
            isFree: event.isFree,
            price: event.price,
            memberOnly: event.memberOnly,
            waitlistEnabled: event.waitlistEnabled,
            registeredCount: regCountMap[event._id.toString()] || 0,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
          };
        }),
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
    const event = await Event.findById(req.params.id).populate('organizerId', 'fullName email').lean();
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Get registration count
    const registeredCount = await EventRegistration.countDocuments({
      eventId: event._id,
      status: 'registered',
    });

    // Calculate automatic status based on dates
    const autoStatus = calculateEventStatus(event);

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
          status: autoStatus, // ✅ Automatically calculated based on dates
          imageUrl: event.imageUrl,
          isFree: event.isFree,
          price: event.price,
          memberOnly: event.memberOnly,
          waitlistEnabled: event.waitlistEnabled,
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
router.post('/', authMiddleware, adminMiddleware, uploadEventImage.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    console.log('\n========== EVENT CREATION REQUEST ==========');
    console.log('📝 Request Headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    });
    console.log('📝 Request Body Keys:', Object.keys(req.body));
    console.log('📝 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('📸 Multer File Object:', req.file ? 'EXISTS' : 'UNDEFINED');
    if (req.file) {
      console.log('📸 File Details:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        destination: req.file.destination,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      });
    }
    console.log('==========================================\n');
    
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
      isFree,
      price,
      memberOnly,
      waitlistEnabled,
    } = req.body;

    // Handle uploaded image
    let imageUrl = undefined;
    if (req.file) {
      // Store relative path from /uploads/events/
      imageUrl = `/uploads/events/${req.file.filename}`;
      console.log('✅ Event image uploaded successfully!');
      console.log('   Image URL:', imageUrl);
      console.log('   File size:', req.file.size, 'bytes');
    } else {
      console.log('⚠️  No image file uploaded for this event');
    }

    // Validate required fields
    const missingFields = [];
    if (!title || title.trim() === '') missingFields.push('title');
    if (!description || description.trim() === '') missingFields.push('description');
    if (!startDate) missingFields.push('startDate');
    
    // Location is required, but for virtual events it can default to "Online"
    if (!location || location.trim() === '') {
      if (isVirtual === 'true' || isVirtual === true) {
        // Auto-set location for virtual events
        req.body.location = 'Online';
      } else {
        missingFields.push('location');
      }
    }
    
    if (missingFields.length > 0) {
      res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}. Please fill in all required fields.` 
      });
      return;
    }

    // Handle two-tier status system: "running" or "cancelled"
    // If "running", auto-calculate based on dates; if "cancelled", keep cancelled
    let eventStatus = status || 'upcoming';
    if (status === 'running' || !status) {
      // Auto-calculate status based on dates
      const now = new Date();
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
      
      if (now < start) {
        eventStatus = 'upcoming';
      } else if (now >= start && now <= end) {
        eventStatus = 'ongoing';
      } else {
        eventStatus = 'completed';
      }
      console.log('📊 Auto-calculated status:', eventStatus);
    } else if (status === 'cancelled') {
      eventStatus = 'cancelled';
      console.log('🔴 Event marked as cancelled');
    }

    const event = new Event({
      title,
      description,
      eventType: eventType || 'Networking',
      startDate,
      endDate,
      location: location || req.body.location,
      virtualLink,
      isVirtual: isVirtual === 'true' || isVirtual === true || false,
      organizerId: req.user!._id,
      chapterId,
      maxAttendees: maxAttendees ? parseInt(maxAttendees) : undefined,
      registrationDeadline,
      status: eventStatus,
      imageUrl,
      isFree: isFree === 'true' || isFree === true,
      price: price ? parseFloat(price) : undefined,
      memberOnly: memberOnly === 'true' || memberOnly === true || false,
      waitlistEnabled: waitlistEnabled === 'true' || waitlistEnabled === true || false,
    });

    await event.save();
    
    console.log('✨ Event created successfully!');
    console.log('   Event ID:', event._id);
    console.log('   Title:', event.title);
    console.log('   Image URL in DB:', event.imageUrl || 'No image');

    res.status(201).json({
      data: {
        event: {
          id: event._id.toString(),
          title: event.title,
          description: event.description,
          eventType: event.eventType,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          isVirtual: event.isVirtual,
          virtualLink: event.virtualLink,
          maxAttendees: event.maxAttendees,
          registrationDeadline: event.registrationDeadline,
          status: event.status,
          imageUrl: event.imageUrl,
          isFree: event.isFree,
          price: event.price,
          memberOnly: event.memberOnly,
          waitlistEnabled: event.waitlistEnabled,
          slug: event.slug,
          createdAt: event.createdAt,
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
router.put('/:id', authMiddleware, adminMiddleware, uploadEventImage.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    console.log('\n========== EVENT UPDATE REQUEST ==========');
    console.log('📝 Event ID:', req.params.id);
    console.log('📝 Request Headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    });
    console.log('📸 Multer File Object:', req.file ? 'EXISTS' : 'UNDEFINED');
    if (req.file) {
      console.log('📸 New Image:', req.file.filename, req.file.size, 'bytes');
    }
    console.log('==========================================\n');

    const event = await Event.findById(req.params.id);
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Handle uploaded image
    if (req.file) {
      // Store relative path from /uploads/events/
      req.body.imageUrl = `/uploads/events/${req.file.filename}`;
      console.log('✅ Event image updated:', req.body.imageUrl);
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
      'isFree',
      'price',
      'memberOnly',
    ];

    // Handle boolean string conversions for FormData
    if (req.body.isVirtual === 'true') req.body.isVirtual = true;
    if (req.body.isVirtual === 'false') req.body.isVirtual = false;
    if (req.body.isFree === 'true') req.body.isFree = true;
    if (req.body.isFree === 'false') req.body.isFree = false;
    if (req.body.memberOnly === 'true') req.body.memberOnly = true;
    if (req.body.memberOnly === 'false') req.body.memberOnly = false;

    // Handle two-tier status system: "running" or "cancelled"
    if (req.body.status === 'running') {
      // Auto-calculate status based on dates
      const now = new Date();
      const start = new Date(req.body.startDate || event.startDate);
      const end = req.body.endDate ? new Date(req.body.endDate) : (event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 24 * 60 * 60 * 1000));
      
      if (now < start) {
        req.body.status = 'upcoming';
      } else if (now >= start && now <= end) {
        req.body.status = 'ongoing';
      } else {
        req.body.status = 'completed';
      }
      console.log('📊 Auto-calculated status on update:', req.body.status);
    } else if (req.body.status === 'cancelled') {
      console.log('🔴 Event updated to cancelled');
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (event as any)[field] = req.body[field];
      }
    });

    await event.save();

    console.log('✨ Event updated successfully!');
    console.log('   Event ID:', event._id.toString());
    console.log('   Title:', event.title);
    console.log('   Image URL:', event.imageUrl || 'No image');

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
          isVirtual: event.isVirtual,
          virtualLink: event.virtualLink,
          maxAttendees: event.maxAttendees,
          status: event.status,
          isFree: event.isFree,
          price: event.price,
          memberOnly: event.memberOnly,
          waitlistEnabled: event.waitlistEnabled,
          slug: event.slug,
          updatedAt: event.updatedAt,
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
    
    // Delete all waitlist entries
    await EventWaitlist.deleteMany({ eventId: event._id });
    
    // Delete all feedback
    await EventFeedback.deleteMany({ eventId: event._id });
    
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
    const { numberOfGuests, guestNames, dietaryRequirements, specialRequests, emergencyContact } = req.body;
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Check if event is open for registration
    if (event.status === 'completed' || event.status === 'cancelled') {
      res.status(400).json({ error: 'Event is not open for registration' });
      return;
    }

    // Check member-only restriction
    if (event.memberOnly && req.user!.role !== 'member' && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'This event is for members only' });
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
        existingRegistration.status = event.requiresApproval ? 'pending' : 'registered';
        existingRegistration.registrationDate = new Date();
        existingRegistration.cancelledAt = undefined;
        existingRegistration.cancellationReason = undefined;
        await existingRegistration.save();
        
        res.json({
          data: { 
            message: 'Registration reactivated successfully',
            registration: {
              id: existingRegistration._id.toString(),
              confirmationCode: existingRegistration.confirmationCode,
              status: existingRegistration.status,
            }
          },
          error: null,
        });
        return;
      } else {
        res.status(400).json({ error: 'Already registered for this event' });
        return;
      }
    }

    // Check max attendees and handle waitlist
    if (event.maxAttendees) {
      const currentRegistrations = await EventRegistration.countDocuments({
        eventId: event._id,
        status: 'registered',
      });

      if (currentRegistrations >= event.maxAttendees) {
        // Add to waitlist if enabled
        if (event.waitlistEnabled) {
          try {
            const waitlistEntry = await WaitlistService.joinWaitlist(req.params.id, req.user!._id);
            res.json({
              data: { 
                message: 'Event is full. You have been added to the waitlist.',
                waitlist: {
                  position: waitlistEntry.position,
                  status: waitlistEntry.status,
                }
              },
              error: null,
            });
            return;
          } catch (waitlistError: any) {
            res.status(400).json({ error: waitlistError.message });
            return;
          }
        } else {
          res.status(400).json({ error: 'Event is full and waitlist is not available' });
          return;
        }
      }
    }

    // Create registration
    const registration = new EventRegistration({
      eventId: event._id,
      userId: req.user!._id,
      status: event.requiresApproval ? 'pending' : 'registered',
      numberOfGuests: numberOfGuests || 0,
      guestNames: guestNames || [],
      dietaryRequirements,
      specialRequests,
      emergencyContact,
      paymentStatus: event.isFree ? 'not_required' : 'pending',
      paymentAmount: event.price,
    });

    await registration.save();

    // Populate user details for response
    await registration.populate('userId', 'fullName email phone');

    res.status(201).json({
      data: { 
        message: event.requiresApproval 
          ? 'Registration submitted for approval' 
          : 'Successfully registered for event',
        registration: {
          id: registration._id.toString(),
          confirmationCode: registration.confirmationCode,
          status: registration.status,
          paymentRequired: !event.isFree,
          user: registration.userId,
          registrationDate: registration.createdAt,
        }
      },
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
    const { reason } = req.body;
    
    const registration = await EventRegistration.findOne({
      eventId: req.params.id,
      userId: req.user!._id,
      status: 'registered',
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Update registration status
    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    registration.cancellationReason = reason;

    // Process refund if payment was completed
    let refundProcessed = false;
    if (registration.paymentStatus === 'completed' && registration.stripePaymentIntentId) {
      try {
        await EventPaymentService.processRefund(
          registration._id.toString(),
          undefined, // Full refund
          reason
        );
        refundProcessed = true;
      } catch (refundError: any) {
        console.error('Refund error:', refundError);
        // Continue with cancellation even if refund fails
      }
    }

    await registration.save();

    // If event has waitlist, promote next person
    if (event.waitlistEnabled) {
      const nextInLine = await EventWaitlist.findOne({
        eventId: event._id,
        status: 'waiting',
      }).sort({ position: 1 });

      if (nextInLine) {
        try {
          await WaitlistService.promoteFromWaitlist(req.params.id, nextInLine.userId);
        } catch (promoteError) {
          console.error('Failed to promote from waitlist:', promoteError);
        }
      }
    }

    res.json({
      data: { 
        message: 'Registration cancelled successfully',
        refundProcessed,
      },
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
router.get('/:id/registrations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const registrations = await EventRegistration.find({ 
      eventId: req.params.id,
      status: { $in: ['registered', 'pending'] } // Only show active registrations
    })
      .populate('userId', 'fullName email phone organization membershipTier')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      data: {
        registrations: registrations.map((reg) => ({
          id: reg._id.toString(),
          name: (reg.userId as any)?.fullName || 'Unknown',
          email: (reg.userId as any)?.email || '',
          phone: (reg.userId as any)?.phone || '',
          organization: (reg.userId as any)?.organization || '',
          membershipTier: (reg.userId as any)?.membershipTier || 'Free Member',
          status: reg.status,
          checkedIn: reg.checkedIn || false,
          checkedInAt: reg.checkedInAt,
          registrationDate: reg.createdAt,
          confirmationCode: reg.confirmationCode,
          numberOfGuests: reg.numberOfGuests || 0,
          dietaryRequirements: reg.dietaryRequirements,
          specialRequests: reg.specialRequests,
        })),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: error.message || 'Failed to get registrations' });
  }
});

// ============ WAITLIST ENDPOINTS ============

// Join waitlist
router.post('/:id/waitlist', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const waitlistEntry = await WaitlistService.joinWaitlist(req.params.id, req.user!._id);
    
    res.status(201).json({
      data: {
        message: 'Added to waitlist successfully',
        waitlist: {
          id: waitlistEntry._id.toString(),
          position: waitlistEntry.position,
          status: waitlistEntry.status,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Join waitlist error:', error);
    res.status(400).json({ error: error.message || 'Failed to join waitlist' });
  }
});

// Leave waitlist
router.delete('/:id/waitlist', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await WaitlistService.leaveWaitlist(req.params.id, req.user!._id);
    
    res.json({
      data: result,
      error: null,
    });
  } catch (error: any) {
    console.error('Leave waitlist error:', error);
    res.status(400).json({ error: error.message || 'Failed to leave waitlist' });
  }
});

// Get waitlist for event (admin only)
router.get('/:id/waitlist', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const waitlist = await WaitlistService.getWaitlist(req.params.id);
    
    res.json({
      data: {
        waitlist: waitlist.map((entry) => ({
          id: entry._id.toString(),
          user: entry.userId,
          position: entry.position,
          status: entry.status,
          joinedAt: entry.joinedAt,
          notified: entry.notified,
          notifiedAt: entry.notifiedAt,
          expiresAt: entry.expiresAt,
        })),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get waitlist error:', error);
    res.status(500).json({ error: error.message || 'Failed to get waitlist' });
  }
});

// Accept waitlist offer
router.post('/:id/waitlist/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const registration = await WaitlistService.acceptOffer(req.params.id, req.user!._id);
    
    res.json({
      data: {
        message: 'Waitlist offer accepted. You are now registered!',
        registration: {
          id: registration._id.toString(),
          confirmationCode: registration.confirmationCode,
          status: registration.status,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Accept waitlist offer error:', error);
    res.status(400).json({ error: error.message || 'Failed to accept offer' });
  }
});

// Promote user from waitlist (admin only)
router.post('/:id/waitlist/:userId/promote', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const waitlistEntry = await WaitlistService.promoteFromWaitlist(req.params.id, userId);
    
    res.json({
      data: {
        message: 'User promoted from waitlist and notified',
        waitlist: {
          id: waitlistEntry._id.toString(),
          status: waitlistEntry.status,
          expiresAt: waitlistEntry.expiresAt,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Promote from waitlist error:', error);
    res.status(400).json({ error: error.message || 'Failed to promote user' });
  }
});

// ============ CHECK-IN ENDPOINTS ============

// Self check-in to event (authenticated users)
router.post('/:id/checkin', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const registration = await EventRegistration.findOne({
      eventId: req.params.id,
      userId: req.user!._id,
      status: 'registered',
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found or not confirmed' });
      return;
    }

    if (registration.checkedIn) {
      res.status(400).json({ error: 'Already checked in' });
      return;
    }

    // Check if event is ongoing
    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const now = new Date();
    if (now < event.startDate) {
      res.status(400).json({ error: 'Check-in not yet available' });
      return;
    }

    // Check in
    registration.checkedIn = true;
    registration.checkedInAt = now;
    await registration.save();

    res.json({
      data: {
        message: 'Checked in successfully',
        checkedInAt: registration.checkedInAt,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: error.message || 'Failed to check in' });
  }
});

// Check in with confirmation code (admin only)
router.post('/:id/checkin/:code', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const registration = await EventRegistration.findOne({
      eventId: req.params.id,
      confirmationCode: req.params.code.toUpperCase(),
    }).populate('userId', 'fullName email');

    if (!registration) {
      res.status(404).json({ error: 'Invalid confirmation code' });
      return;
    }

    if (registration.status !== 'registered') {
      res.status(400).json({ error: `Cannot check in. Registration status: ${registration.status}` });
      return;
    }

    if (registration.checkedIn) {
      res.json({
        data: {
          message: 'User already checked in',
          registration: {
            user: registration.userId,
            checkedInAt: registration.checkedInAt,
          },
        },
        error: null,
      });
      return;
    }

    // Check in
    registration.checkedIn = true;
    registration.checkedInAt = new Date();
    registration.checkedInBy = req.user!._id;
    await registration.save();

    res.json({
      data: {
        message: 'User checked in successfully',
        registration: {
          user: registration.userId,
          confirmationCode: registration.confirmationCode,
          checkedInAt: registration.checkedInAt,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Check-in with code error:', error);
    res.status(500).json({ error: error.message || 'Failed to check in' });
  }
});

// Get checked-in attendees (admin only)
router.get('/:id/attendees', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const registrations = await EventRegistration.find({
      eventId: req.params.id,
      checkedIn: true,
    })
      .populate('userId', 'fullName email phone organization')
      .sort({ checkedInAt: -1 });

    res.json({
      data: {
        attendees: registrations.map((reg) => ({
          id: reg._id.toString(),
          user: reg.userId,
          confirmationCode: reg.confirmationCode,
          checkedInAt: reg.checkedInAt,
          numberOfGuests: reg.numberOfGuests,
        })),
        totalCheckedIn: registrations.length,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get attendees error:', error);
    res.status(500).json({ error: error.message || 'Failed to get attendees' });
  }
});

// ============ FEEDBACK ENDPOINTS ============

// Submit event feedback (authenticated users)
router.post('/:id/feedback', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rating, comment, categories, isAnonymous } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5' });
      return;
    }

    // Check if user attended the event
    const registration = await EventRegistration.findOne({
      eventId: req.params.id,
      userId: req.user!._id,
      checkedIn: true,
    });

    if (!registration) {
      res.status(403).json({ error: 'Only attendees who checked in can provide feedback' });
      return;
    }

    // Check if feedback already submitted
    const existingFeedback = await EventFeedback.findOne({
      eventId: req.params.id,
      userId: req.user!._id,
    });

    if (existingFeedback) {
      res.status(400).json({ error: 'Feedback already submitted for this event' });
      return;
    }

    const feedback = new EventFeedback({
      eventId: req.params.id,
      userId: req.user!._id,
      rating,
      comment,
      categories: categories || {},
      isAnonymous: isAnonymous || false,
      approved: true, // Auto-approve for now
    });

    await feedback.save();

    res.status(201).json({
      data: {
        message: 'Feedback submitted successfully',
        feedback: {
          id: feedback._id.toString(),
          rating: feedback.rating,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit feedback' });
  }
});

// Get event feedback
router.get('/:id/feedback', async (req: Request, res: Response) => {
  try {
    const feedback = await EventFeedback.find({
      eventId: req.params.id,
      approved: true,
    })
      .populate('userId', 'fullName')
      .sort({ createdAt: -1 });

    // Calculate average ratings
    const totalFeedback = feedback.length;
    const averageRating = totalFeedback > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback
      : 0;

    const categoryAverages = {
      venue: 0,
      content: 0,
      organization: 0,
      networking: 0,
    };

    if (totalFeedback > 0) {
      let venueCount = 0, contentCount = 0, orgCount = 0, netCount = 0;
      
      feedback.forEach((f) => {
        if (f.categories.venue) { categoryAverages.venue += f.categories.venue; venueCount++; }
        if (f.categories.content) { categoryAverages.content += f.categories.content; contentCount++; }
        if (f.categories.organization) { categoryAverages.organization += f.categories.organization; orgCount++; }
        if (f.categories.networking) { categoryAverages.networking += f.categories.networking; netCount++; }
      });

      if (venueCount > 0) categoryAverages.venue /= venueCount;
      if (contentCount > 0) categoryAverages.content /= contentCount;
      if (orgCount > 0) categoryAverages.organization /= orgCount;
      if (netCount > 0) categoryAverages.networking /= netCount;
    }

    res.json({
      data: {
        feedback: feedback.map((f) => ({
          id: f._id.toString(),
          user: f.isAnonymous ? null : f.userId,
          rating: f.rating,
          comment: f.comment,
          categories: f.categories,
          isAnonymous: f.isAnonymous,
          helpfulCount: f.helpfulCount,
          createdAt: f.createdAt,
        })),
        stats: {
          totalFeedback,
          averageRating: parseFloat(averageRating.toFixed(1)),
          categoryAverages,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: error.message || 'Failed to get feedback' });
  }
});

// Approve feedback (admin only)
router.put('/:id/feedback/:feedbackId/approve', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const feedback = await EventFeedback.findById(req.params.feedbackId);
    
    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    if (feedback.eventId.toString() !== req.params.id) {
      res.status(400).json({ error: 'Feedback does not belong to this event' });
      return;
    }

    feedback.approved = true;
    await feedback.save();

    res.json({
      data: {
        message: 'Feedback approved',
        feedback: {
          id: feedback._id.toString(),
          approved: feedback.approved,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Approve feedback error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve feedback' });
  }
});

// ============ ANALYTICS ENDPOINTS ============

// Get event analytics (admin only)
router.get('/:id/analytics', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Registration statistics
    const totalRegistrations = await EventRegistration.countDocuments({
      eventId: event._id,
      status: { $in: ['registered', 'attended', 'pending'] },
    });

    const checkedInCount = await EventRegistration.countDocuments({
      eventId: event._id,
      checkedIn: true,
    });

    const cancelledCount = await EventRegistration.countDocuments({
      eventId: event._id,
      status: 'cancelled',
    });

    const pendingCount = await EventRegistration.countDocuments({
      eventId: event._id,
      status: 'pending',
    });

    // Payment statistics (if paid event)
    let paymentStats = null;
    if (!event.isFree) {
      const paidCount = await EventRegistration.countDocuments({
        eventId: event._id,
        paymentStatus: 'completed',
      });

      const pendingPayments = await EventRegistration.countDocuments({
        eventId: event._id,
        paymentStatus: 'pending',
      });

      const totalRevenue = await EventRegistration.aggregate([
        { $match: { eventId: event._id, paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$paymentAmount' } } },
      ]);

      paymentStats = {
        paidRegistrations: paidCount,
        pendingPayments,
        totalRevenue: totalRevenue[0]?.total || 0,
        expectedRevenue: (event.price || 0) * totalRegistrations,
      };
    }

    // Waitlist statistics
    const waitlistCount = await EventWaitlist.countDocuments({
      eventId: event._id,
      status: 'waiting',
    });

    // Feedback statistics
    const feedbackCount = await EventFeedback.countDocuments({
      eventId: event._id,
    });

    const feedbackStats = await EventFeedback.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalFeedback: { $sum: 1 },
        },
      },
    ]);

    // Registration by type
    const registrationByType = await EventRegistration.aggregate([
      { $match: { eventId: event._id, status: 'registered' } },
      {
        $group: {
          _id: '$registrationType',
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      data: {
        event: {
          id: event._id.toString(),
          title: event.title,
          startDate: event.startDate,
          status: event.status,
          capacity: event.maxAttendees,
        },
        registrations: {
          total: totalRegistrations,
          checkedIn: checkedInCount,
          cancelled: cancelledCount,
          pending: pendingCount,
          attendanceRate: totalRegistrations > 0 
            ? parseFloat(((checkedInCount / totalRegistrations) * 100).toFixed(1))
            : 0,
          byType: registrationByType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
        },
        waitlist: {
          total: waitlistCount,
          enabled: event.waitlistEnabled,
          capacity: event.waitlistCapacity,
        },
        payments: paymentStats,
        feedback: {
          total: feedbackCount,
          averageRating: feedbackStats[0]?.averageRating 
            ? parseFloat(feedbackStats[0].averageRating.toFixed(1))
            : null,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get analytics' });
  }
});

// Export events data (admin only)
router.get('/export/csv', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    const filter: any = {};
    if (startDate) filter.startDate = { $gte: new Date(startDate as string) };
    if (endDate) filter.startDate = { ...filter.startDate, $lte: new Date(endDate as string) };
    if (status) filter.status = status;

    const events = await Event.find(filter)
      .populate('organizerId', 'fullName email')
      .sort({ startDate: -1 })
      .lean();

    // Get registration counts for each event
    const eventStats = await Promise.all(
      events.map(async (event) => {
        const totalRegistrations = await EventRegistration.countDocuments({
          eventId: event._id,
          status: 'registered',
        });
        
        const checkedIn = await EventRegistration.countDocuments({
          eventId: event._id,
          checkedIn: true,
        });

        return {
          ...event,
          totalRegistrations,
          checkedIn,
        };
      })
    );

    res.json({
      data: {
        events: eventStats.map((event) => ({
          id: event._id.toString(),
          title: event.title,
          eventType: event.eventType,
          startDate: event.startDate,
          location: event.location,
          isVirtual: event.isVirtual,
          maxAttendees: event.maxAttendees,
          registrations: event.totalRegistrations,
          checkedIn: event.checkedIn,
          status: event.status,
          isFree: event.isFree,
          price: event.price,
          memberOnly: event.memberOnly,
          organizer: event.organizerId,
        })),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Export events error:', error);
    res.status(500).json({ error: error.message || 'Failed to export events' });
  }
});

// ============ PAYMENT ENDPOINTS ============

// Create payment intent for event registration
router.post('/:id/payment', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { registrationId } = req.body;

    if (!registrationId) {
      res.status(400).json({ error: 'Registration ID is required' });
      return;
    }

    const paymentData = await EventPaymentService.createPaymentIntent(
      req.params.id,
      req.user!._id,
      registrationId
    );

    res.json({
      data: paymentData,
      error: null,
    });
  } catch (error: any) {
    console.error('Create payment intent error:', error);
    res.status(400).json({ error: error.message || 'Failed to create payment intent' });
  }
});

// Confirm payment
router.post('/:id/payment/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      res.status(400).json({ error: 'Payment intent ID is required' });
      return;
    }

    const registration = await EventPaymentService.confirmPayment(paymentIntentId);

    res.json({
      data: {
        message: 'Payment confirmed successfully',
        registration: {
          id: registration._id.toString(),
          confirmationCode: registration.confirmationCode,
          status: registration.status,
          paymentStatus: registration.paymentStatus,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Confirm payment error:', error);
    res.status(400).json({ error: error.message || 'Failed to confirm payment' });
  }
});

// Get payment status
router.get('/:id/payment/:registrationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const paymentStatus = await EventPaymentService.getPaymentStatus(
      req.params.registrationId,
      req.user!._id
    );

    res.json({
      data: paymentStatus,
      error: null,
    });
  } catch (error: any) {
    console.error('Get payment status error:', error);
    res.status(400).json({ error: error.message || 'Failed to get payment status' });
  }
});

// Process refund (admin only)
router.post('/:id/refund/:registrationId', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, reason } = req.body;

    const result = await EventPaymentService.processRefund(
      req.params.registrationId,
      amount,
      reason
    );

    res.json({
      data: {
        message: 'Refund processed successfully',
        refund: {
          amount: result.refund.amount / 100, // Convert from cents
          status: result.refund.status,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Process refund error:', error);
    res.status(400).json({ error: error.message || 'Failed to process refund' });
  }
});

export default router;
