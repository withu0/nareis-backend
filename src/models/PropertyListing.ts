import mongoose, { Document, Schema } from 'mongoose';

export type PropertyListingStatus = 'active' | 'archived';

/** Shown on public marketplace vs hidden while listing remains active in the owner’s dashboard. */
export type PropertyListingVisibility = 'visible' | 'hidden';

export interface IPropertyListing extends Document {
  ownerId: mongoose.Types.ObjectId;
  location: string;
  dealType: string;
  squareFootage: number;
  priceMin: number;
  priceMax: number;
  estimatedArv: number;
  imageUrls: string[];
  status: PropertyListingStatus;
  visibility: PropertyListingVisibility;
  createdAt: Date;
  updatedAt: Date;
}

const propertyListingSchema = new Schema<IPropertyListing>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    dealType: {
      type: String,
      required: true,
      trim: true,
    },
    squareFootage: {
      type: Number,
      required: true,
      min: 0,
    },
    priceMin: {
      type: Number,
      required: true,
      min: 0,
    },
    priceMax: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedArv: {
      type: Number,
      required: true,
      min: 0,
    },
    imageUrls: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    visibility: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
      index: true,
    },
  },
  { timestamps: true }
);

propertyListingSchema.index({ ownerId: 1, createdAt: -1 });
propertyListingSchema.index({ status: 1, createdAt: -1 });
propertyListingSchema.index({ status: 1, visibility: 1, createdAt: -1 });

export const PropertyListing = mongoose.model<IPropertyListing>(
  'PropertyListing',
  propertyListingSchema
);
