import mongoose, { Document, Schema } from 'mongoose';

export interface IPropertyListingInterest extends Document {
  listingId: mongoose.Types.ObjectId;
  interestedUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const propertyListingInterestSchema = new Schema<IPropertyListingInterest>(
  {
    listingId: {
      type: Schema.Types.ObjectId,
      ref: 'PropertyListing',
      required: true,
      index: true,
    },
    interestedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

propertyListingInterestSchema.index(
  { listingId: 1, interestedUserId: 1 },
  { unique: true }
);

export const PropertyListingInterest = mongoose.model<IPropertyListingInterest>(
  'PropertyListingInterest',
  propertyListingInterestSchema
);
