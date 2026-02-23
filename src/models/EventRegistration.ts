import mongoose, { Document, Schema } from 'mongoose';
import { generateConfirmationCode } from '../utils/confirmationCode.js';

export interface IEventRegistration extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  registrationDate: Date;
  status: 'registered' | 'attended' | 'cancelled' | 'pending';
  // Registration details
  registrationType: 'regular' | 'waitlist' | 'guest';
  numberOfGuests: number;
  guestNames?: string[];
  confirmationCode: string;
  // Payment tracking
  paymentStatus: 'pending' | 'completed' | 'refunded' | 'failed' | 'not_required';
  paymentAmount?: number;
  stripePaymentIntentId?: string;
  paidAt?: Date;
  // Check-in tracking
  checkedIn: boolean;
  checkedInAt?: Date;
  checkedInBy?: mongoose.Types.ObjectId;
  // Additional info
  dietaryRequirements?: string;
  specialRequests?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  // Communication
  emailSent: boolean;
  remindersSent: number;
  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;
  refundAmount?: number;
  refundedAt?: Date;
  createdAt: Date;
}

// Method to generate confirmation code
export interface IEventRegistrationMethods {
  generateConfirmationCode(): string;
}

export interface IEventRegistrationModel extends mongoose.Model<IEventRegistration, {}, IEventRegistrationMethods> {}

const eventRegistrationSchema = new Schema<IEventRegistration, IEventRegistrationModel, IEventRegistrationMethods>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['registered', 'attended', 'cancelled', 'pending'],
      default: 'registered',
    },
    registrationType: {
      type: String,
      enum: ['regular', 'waitlist', 'guest'],
      default: 'regular',
    },
    numberOfGuests: {
      type: Number,
      default: 0,
      min: 0,
    },
    guestNames: {
      type: [String],
    },
    confirmationCode: {
      type: String,
      required: true,
      unique: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'refunded', 'failed', 'not_required'],
      default: 'not_required',
    },
    paymentAmount: {
      type: Number,
      min: 0,
    },
    stripePaymentIntentId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
    },
    checkedInBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dietaryRequirements: {
      type: String,
    },
    specialRequests: {
      type: String,
    },
    emergencyContact: {
      name: String,
      phone: String,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    remindersSent: {
      type: Number,
      default: 0,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
    },
    refundAmount: {
      type: Number,
    },
    refundedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Generate confirmation code before validation
eventRegistrationSchema.pre('validate', function(next) {
  if (!this.confirmationCode) {
    this.confirmationCode = generateConfirmationCode();
  }
  next();
});

// Method to generate confirmation code
eventRegistrationSchema.methods.generateConfirmationCode = function() {
  return generateConfirmationCode();
};

// Indexes
eventRegistrationSchema.index({ eventId: 1 });
eventRegistrationSchema.index({ userId: 1 });
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true }); // Prevent duplicate registrations
eventRegistrationSchema.index({ confirmationCode: 1 }, { unique: true });
eventRegistrationSchema.index({ status: 1 });
eventRegistrationSchema.index({ paymentStatus: 1 });
eventRegistrationSchema.index({ checkedIn: 1 });

export const EventRegistration = mongoose.model<IEventRegistration, IEventRegistrationModel>(
  'EventRegistration',
  eventRegistrationSchema
);
