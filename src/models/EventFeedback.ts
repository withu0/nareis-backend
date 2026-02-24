import mongoose, { Document, Schema } from 'mongoose';

export interface IEventFeedback extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  categories: {
    venue?: number;
    content?: number;
    organization?: number;
    networking?: number;
  };
  isAnonymous: boolean;
  approved: boolean;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const eventFeedbackSchema = new Schema<IEventFeedback>(
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 1000,
    },
    categories: {
      venue: { type: Number, min: 1, max: 5 },
      content: { type: Number, min: 1, max: 5 },
      organization: { type: Number, min: 1, max: 5 },
      networking: { type: Number, min: 1, max: 5 },
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    approved: {
      type: Boolean,
      default: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventFeedbackSchema.index({ eventId: 1 });
eventFeedbackSchema.index({ userId: 1 });
eventFeedbackSchema.index({ eventId: 1, userId: 1 }, { unique: true }); // One feedback per user per event
eventFeedbackSchema.index({ approved: 1 });
eventFeedbackSchema.index({ rating: 1 });

export const EventFeedback = mongoose.model<IEventFeedback>(
  'EventFeedback',
  eventFeedbackSchema
);
