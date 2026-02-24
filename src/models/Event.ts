import mongoose, { Document, Schema } from 'mongoose';
import { generateUniqueSlug } from '../utils/slugify.js';

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
  isFree: boolean;
  price?: number;
  memberOnly: boolean;
  // Waitlist management
  waitlistEnabled: boolean;
  waitlistCapacity?: number;
  // Event categorization
  tags?: string[];
  category?: string;
  // Event settings
  allowGuestRegistration: boolean;
  requiresApproval: boolean;
  cancellationDeadline?: Date;
  // SEO
  slug: string;
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
    isFree: {
      type: Boolean,
      default: true,
    },
    price: {
      type: Number,
      min: 0,
    },
    memberOnly: {
      type: Boolean,
      default: false,
    },
    waitlistEnabled: {
      type: Boolean,
      default: false,
    },
    waitlistCapacity: {
      type: Number,
      min: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
    },
    allowGuestRegistration: {
      type: Boolean,
      default: true,
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    cancellationDeadline: {
      type: Date,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
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
// eventSchema.index({ slug: 1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ isFree: 1 });
eventSchema.index({ memberOnly: 1 });

// Method to automatically determine event status based on dates
eventSchema.methods.updateAutoStatus = function() {
  // Never change cancelled events
  if (this.status === 'cancelled') {
    return this.status;
  }

  const now = new Date();
  const startDate = new Date(this.startDate);
  const endDate = this.endDate ? new Date(this.endDate) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours if no end date

  if (now < startDate) {
    this.status = 'upcoming';
  } else if (now >= startDate && now <= endDate) {
    this.status = 'ongoing';
  } else if (now > endDate) {
    this.status = 'completed';
  }

  return this.status;
};

// Generate slug before validation
eventSchema.pre('validate', function(next) {
  if (!this.slug && this.title) {
    this.slug = generateUniqueSlug(this.title);
  }
  next();
});

// Automatically update status before saving (unless manually set to cancelled)
eventSchema.pre('save', function(next) {
  // Only auto-update if status is not being manually set to cancelled
  if (this.isModified('status') && this.status === 'cancelled') {
    // Keep cancelled status
    return next();
  }
  
  // Auto-update status based on dates
  (this as any).updateAutoStatus();
  next();
});

export const Event = mongoose.model<IEvent>('Event', eventSchema);
