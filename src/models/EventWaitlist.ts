import mongoose, { Document, Schema } from 'mongoose';

export interface IEventWaitlist extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  position: number;
  joinedAt: Date;
  notified: boolean;
  notifiedAt?: Date;
  status: 'waiting' | 'offered' | 'accepted' | 'declined' | 'expired';
  expiresAt?: Date;
  createdAt: Date;
}

const eventWaitlistSchema = new Schema<IEventWaitlist>(
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
    position: {
      type: Number,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    notified: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['waiting', 'offered', 'accepted', 'declined', 'expired'],
      default: 'waiting',
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventWaitlistSchema.index({ eventId: 1 });
eventWaitlistSchema.index({ userId: 1 });
eventWaitlistSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventWaitlistSchema.index({ eventId: 1, position: 1 });
eventWaitlistSchema.index({ status: 1 });

export const EventWaitlist = mongoose.model<IEventWaitlist>(
  'EventWaitlist',
  eventWaitlistSchema
);
