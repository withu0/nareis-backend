import Stripe from 'stripe';
import { Event } from '../models/Event.js';
import { EventRegistration } from '../models/EventRegistration.js';
import mongoose from 'mongoose';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export class EventPaymentService {
  /**
   * Create a payment intent for event registration
   */
  static async createPaymentIntent(
    eventId: string,
    userId: mongoose.Types.ObjectId,
    registrationId: string
  ) {
    const event = await Event.findById(eventId);
    
    if (!event) {
      throw new Error('Event not found');
    }

    if (event.isFree) {
      throw new Error('This event is free');
    }

    if (!event.price || event.price <= 0) {
      throw new Error('Invalid event price');
    }

    const registration = await EventRegistration.findById(registrationId);
    
    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    if (registration.paymentStatus === 'completed') {
      throw new Error('Payment already completed');
    }

    // Calculate total amount (event price + guests)
    const totalAmount = event.price * (1 + (registration.numberOfGuests || 0));

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Stripe uses cents
      currency: 'usd',
      metadata: {
        eventId: event._id.toString(),
        registrationId: registration._id.toString(),
        userId: userId.toString(),
        eventTitle: event.title,
      },
      description: `Event Registration: ${event.title}`,
    });

    // Update registration with payment intent
    registration.stripePaymentIntentId = paymentIntent.id;
    registration.paymentAmount = totalAmount;
    await registration.save();

    return {
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Confirm payment and update registration
   */
  static async confirmPayment(paymentIntentId: string) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment not successful');
    }

    const registration = await EventRegistration.findOne({
      stripePaymentIntentId: paymentIntentId,
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.paymentStatus === 'completed') {
      return registration; // Already processed
    }

    // Update registration
    registration.paymentStatus = 'completed';
    registration.paidAt = new Date();
    registration.status = 'registered'; // Move from pending to registered
    await registration.save();

    return registration;
  }

  /**
   * Process refund for cancelled registration
   */
  static async processRefund(
    registrationId: string,
    refundAmount?: number,
    reason?: string
  ) {
    const registration = await EventRegistration.findById(registrationId);
    
    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.paymentStatus !== 'completed') {
      throw new Error('No completed payment to refund');
    }

    if (!registration.stripePaymentIntentId) {
      throw new Error('No payment intent found');
    }

    // Get event to check cancellation policy
    const event = await Event.findById(registration.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Check if past cancellation deadline
    if (event.cancellationDeadline && new Date() > event.cancellationDeadline) {
      throw new Error('Past cancellation deadline. Refunds are not available.');
    }

    // Calculate refund amount (default to full refund)
    const amountToRefund = refundAmount || registration.paymentAmount || 0;
    
    if (amountToRefund <= 0) {
      throw new Error('Invalid refund amount');
    }

    // Create Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: registration.stripePaymentIntentId,
      amount: Math.round(amountToRefund * 100), // Stripe uses cents
      reason: 'requested_by_customer',
      metadata: {
        registrationId: registration._id.toString(),
        reason: reason || 'User requested cancellation',
      },
    });

    // Update registration
    registration.paymentStatus = 'refunded';
    registration.refundAmount = amountToRefund;
    registration.refundedAt = new Date();
    await registration.save();

    return {
      refund,
      registration,
    };
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(registrationId: string, userId: mongoose.Types.ObjectId) {
    const registration = await EventRegistration.findById(registrationId);
    
    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    return {
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount,
      paidAt: registration.paidAt,
      stripePaymentIntentId: registration.stripePaymentIntentId,
    };
  }
}
