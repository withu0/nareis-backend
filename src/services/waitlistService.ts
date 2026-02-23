import { EventWaitlist } from '../models/EventWaitlist.js';
import { Event } from '../models/Event.js';
import { EventRegistration } from '../models/EventRegistration.js';
import mongoose from 'mongoose';

export class WaitlistService {
  /**
   * Add user to event waitlist
   */
  static async joinWaitlist(eventId: string, userId: mongoose.Types.ObjectId) {
    const event = await Event.findById(eventId);
    
    if (!event) {
      throw new Error('Event not found');
    }

    if (!event.waitlistEnabled) {
      throw new Error('Waitlist is not enabled for this event');
    }

    // Check if already on waitlist
    const existing = await EventWaitlist.findOne({ eventId, userId });
    if (existing) {
      throw new Error('Already on waitlist');
    }

    // Check if already registered
    const registration = await EventRegistration.findOne({ eventId, userId, status: 'registered' });
    if (registration) {
      throw new Error('Already registered for this event');
    }

    // Get next position
    const currentCount = await EventWaitlist.countDocuments({ eventId, status: 'waiting' });
    
    // Check waitlist capacity
    if (event.waitlistCapacity && currentCount >= event.waitlistCapacity) {
      throw new Error('Waitlist is full');
    }

    const position = currentCount + 1;

    const waitlistEntry = new EventWaitlist({
      eventId,
      userId,
      position,
    });

    await waitlistEntry.save();
    return waitlistEntry;
  }

  /**
   * Remove user from waitlist
   */
  static async leaveWaitlist(eventId: string, userId: mongoose.Types.ObjectId) {
    const waitlistEntry = await EventWaitlist.findOne({ eventId, userId, status: 'waiting' });
    
    if (!waitlistEntry) {
      throw new Error('Not on waitlist');
    }

    const position = waitlistEntry.position;
    await EventWaitlist.deleteOne({ _id: waitlistEntry._id });

    // Update positions for users after this one
    await EventWaitlist.updateMany(
      { eventId, position: { $gt: position }, status: 'waiting' },
      { $inc: { position: -1 } }
    );

    return { message: 'Removed from waitlist' };
  }

  /**
   * Get waitlist for an event
   */
  static async getWaitlist(eventId: string) {
    const waitlist = await EventWaitlist.find({ eventId })
      .populate('userId', 'fullName email')
      .sort({ position: 1 });

    return waitlist;
  }

  /**
   * Promote user from waitlist to registered
   */
  static async promoteFromWaitlist(eventId: string, userId: mongoose.Types.ObjectId) {
    const waitlistEntry = await EventWaitlist.findOne({ eventId, userId, status: 'waiting' });
    
    if (!waitlistEntry) {
      throw new Error('User not on waitlist');
    }

    const event = await Event.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Check if event still has capacity
    const currentRegistrations = await EventRegistration.countDocuments({
      eventId,
      status: 'registered',
    });

    if (event.maxAttendees && currentRegistrations >= event.maxAttendees) {
      throw new Error('Event is still full');
    }

    // Mark waitlist entry as offered
    waitlistEntry.status = 'offered';
    waitlistEntry.notified = true;
    waitlistEntry.notifiedAt = new Date();
    // Set expiration (24 hours to accept)
    waitlistEntry.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await waitlistEntry.save();

    return waitlistEntry;
  }

  /**
   * Accept waitlist offer and create registration
   */
  static async acceptOffer(eventId: string, userId: mongoose.Types.ObjectId) {
    const waitlistEntry = await EventWaitlist.findOne({ eventId, userId, status: 'offered' });
    
    if (!waitlistEntry) {
      throw new Error('No active offer found');
    }

    // Check if offer expired
    if (waitlistEntry.expiresAt && new Date() > waitlistEntry.expiresAt) {
      waitlistEntry.status = 'expired';
      await waitlistEntry.save();
      throw new Error('Offer has expired');
    }

    const event = await Event.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Check capacity again
    const currentRegistrations = await EventRegistration.countDocuments({
      eventId,
      status: 'registered',
    });

    if (event.maxAttendees && currentRegistrations >= event.maxAttendees) {
      throw new Error('Event is full');
    }

    // Create registration
    const registration = new EventRegistration({
      eventId,
      userId,
      registrationType: 'waitlist',
      paymentStatus: event.isFree ? 'not_required' : 'pending',
    });

    await registration.save();

    // Update waitlist entry
    waitlistEntry.status = 'accepted';
    await waitlistEntry.save();

    // Update positions for remaining waitlist
    const position = waitlistEntry.position;
    await EventWaitlist.updateMany(
      { eventId, position: { $gt: position }, status: 'waiting' },
      { $inc: { position: -1 } }
    );

    return registration;
  }
}
