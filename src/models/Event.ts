import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  title: string;
  description: string;
  eventType: string;
  startDate: Date;
  endDate?: Date;
  location: string;
  virtualLink?: string;
  isVirtual: boolean;
  organizerId: mongoose.Types.ObjectId;
  chapterId?: string;
  maxAttendees?: number;
  registrationDeadline?: Date;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      default: 'Networking',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    location: {
      type: String,
      required: true,
    },
    virtualLink: {
      type: String,
    },
    isVirtual: {
      type: Boolean,
      default: false,
    },
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    chapterId: {
      type: String,
    },
    maxAttendees: {
      type: Number,
    },
    registrationDeadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    imageUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
eventSchema.index({ startDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ organizerId: 1 });
eventSchema.index({ eventType: 1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
