import mongoose, { Document, Schema } from 'mongoose';

export interface IEventRegistration extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  registrationDate: Date;
  status: 'registered' | 'attended' | 'cancelled';
  createdAt: Date;
}

const eventRegistrationSchema = new Schema<IEventRegistration>(
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
      enum: ['registered', 'attended', 'cancelled'],
      default: 'registered',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventRegistrationSchema.index({ eventId: 1 });
eventRegistrationSchema.index({ userId: 1 });
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true }); // Prevent duplicate registrations

export const EventRegistration = mongoose.model<IEventRegistration>(
  'EventRegistration',
  eventRegistrationSchema
);
