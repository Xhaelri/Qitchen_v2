// stripeConfig.model.js
import mongoose from "mongoose";

const stripeConfigSchema = new mongoose.Schema(
  {
    // Order Amount Settings
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxOrderAmount: {
      type: Number,
      default: 10000,
      min: 0,
    },
    
    // Refund Settings
    refundWindowHours: {
      type: Number,
      default: 24,
      min: 0,
    },
    allowPartialRefunds: {
      type: Boolean,
      default: true,
    },
    autoRefundOnCancellation: {
      type: Boolean,
      default: false,
    },
    
    // Checkout UX Settings
    useStripeCheckout: {
      type: Boolean,
      default: true, // true = Stripe hosted, false = custom form
    },
    saveCardForFutureUse: {
      type: Boolean,
      default: true,
    },
    allowGuestCheckout: {
      type: Boolean,
      default: true,
    },
    
    // Delivery Settings
    defaultDeliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const StripeConfig = mongoose.model("StripeConfig", stripeConfigSchema);

export default StripeConfig;
