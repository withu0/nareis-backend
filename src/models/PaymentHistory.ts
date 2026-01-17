import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentHistory extends Document {
  userId: mongoose.Types.ObjectId;
  subscriptionId?: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  invoiceUrl?: string;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentHistorySchema = new Schema<IPaymentHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subscriptionId: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['succeeded', 'failed', 'pending', 'refunded'],
      required: true,
    },
    invoiceUrl: {
      type: String,
    },
    stripePaymentIntentId: {
      type: String,
    },
    stripeInvoiceId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentHistorySchema.index({ userId: 1 });
paymentHistorySchema.index({ subscriptionId: 1 });
paymentHistorySchema.index({ createdAt: -1 });

export const PaymentHistory = mongoose.model<IPaymentHistory>(
  'PaymentHistory',
  paymentHistorySchema
);
