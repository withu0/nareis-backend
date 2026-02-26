import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser extends Document {
  email: string;
  password: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone?: string;
  organization?: string;
  jobTitle?: string;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  role: 'member' | 'admin';
  membershipTier: string;
  membershipStatus: 'pending' | 'approved' | 'rejected' | 'active';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  onboardingCompleted: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  membershipExpiresAt?: Date;
  chapterId?: string;
  interests?: string[];
  profilePictureUrl?: string;
  state?: string;
  city?: string;
  industry?: string;
  bio?: string;
  website?: string;
  linkedin?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateVerificationToken(): string;
  generateResetToken(): string;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    fullName: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      default: '',
    },
    lastName: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
    },
    organization: {
      type: String,
    },
    jobTitle: {
      type: String,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
    verificationTokenExpires: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member',
    },
    membershipTier: {
      type: String,
      default: 'foundation',
    },
    membershipStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active'],
      default: 'pending',
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    stripeCustomerId: {
      type: String,
    },
    stripeSubscriptionId: {
      type: String,
    },
    membershipExpiresAt: {
      type: Date,
    },
    chapterId: {
      type: String,
    },
    interests: {
      type: [String],
      default: [],
    },
    profilePictureUrl: {
      type: String,
    },
    state: {
      type: String,
    },
    city: {
      type: String,
    },
    industry: {
      type: String,
    },
    bio: {
      type: String,
    },
    website: {
      type: String,
    },
    linkedin: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate verification token
userSchema.methods.generateVerificationToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = token;
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return token;
};

// Generate password reset token
userSchema.methods.generateResetToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = token;
  this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return token;
};

// Indexes
//userSchema.index({ email: 1 });
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
