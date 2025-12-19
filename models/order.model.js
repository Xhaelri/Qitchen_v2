// models/order.model.js (COMPLETE UPDATED VERSION)
import mongoose, { Schema } from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        _id: false,
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
      },
    ],
    // ✅ NEW: Subtotal (products only, before delivery)
    subtotal: {
      type: Number,
      required: true,
      validate: {
        validator: function (value) {
          return value > 0;
        },
        message: "Subtotal must be a positive Number",
      },
    },
    // ✅ NEW: Delivery fee (calculated based on location)
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    // UPDATED: Total price (subtotal + deliveryFee)
    totalPrice: {
      type: Number,
      required: true,
      validate: {
        validator: function (value) {
          return value > 0;
        },
        message: "Total price must be a positive Number",
      },
    },
    totalQuantity: {
      type: Number,
      default: 1,
    },
    paymentMethod: {
      type: String,
      enum: ["Card", "COD"],
      default: "Card",
    },
    // ✅ UPDATED: Added "Refunded" and "PartiallyRefunded" statuses
    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Cancelled", "Refunded", "PartiallyRefunded"],
      default: "Pending",
      required: true,
    },
    paymentDetails: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    address: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
    // ✅ NEW: Delivery location (governorate and city for online orders)
    deliveryLocation: {
      governorate: {
        type: String,
        required: function() {
          return this.placeType === "Online";
        },
      },
      city: {
        type: String,
        required: function() {
          return this.placeType === "Online";
        },
      },
    },
    placeType: {
      type: String,
      enum: ["Online", "In-Place", "Takeaway"],
      default: "Online",
    },
    table: {
      type: Schema.Types.ObjectId,
      ref: "Table",
      required: false,
    },
    stripeSessionID: {
      type: String,
      unique: true,
      sparse: true,
    },
    // ✅ NEW: Stripe payment intent ID (needed for refunds)
    stripePaymentIntentId: {
      type: String,
      sparse: true,
    },
    // ✅ UPDATED: Added "Cancelled" status
    orderStatus: {
      type: String,
      enum: ["Processing", "Paid", "Ready", "On the way", "Received", "Failed", "Cancelled"],
      default: "Processing",
      required: true,
    },
    // ✅ NEW: Refund details tracking
    refundDetails: {
      refundId: {
        type: String,
      },
      refundAmount: {
        type: Number,
      },
      refundDate: {
        type: Date,
      },
      refundReason: {
        type: String,
      },
      refundStatus: {
        type: String,
        enum: ["Pending", "Completed", "Failed"],
      },
    },
  },
  { timestamps: true }
);

orderSchema.plugin(aggregatePaginate);

const Order = mongoose.model("Order", orderSchema);

export default Order;