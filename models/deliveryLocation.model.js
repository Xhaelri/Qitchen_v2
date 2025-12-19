import mongoose from "mongoose";

const deliveryLocationSchema = new mongoose.Schema(
  {
    governorate: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function(value) {
          return value >= 0;
        },
        message: "Delivery fee must be a positive number",
      },
    },
    estimatedDeliveryTime: {
      type: String,
      default: "30-45 mins",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique governorate-city combinations
deliveryLocationSchema.index({ governorate: 1, city: 1 }, { unique: true });

const DeliveryLocation = mongoose.model("DeliveryLocation", deliveryLocationSchema);

export default DeliveryLocation;