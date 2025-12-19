import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ["Card", "COD"],
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    image: {
      type: [String],
      required: true,
      validate: {
        validator: function (array) {
          return array.length > 0;
        },
        message: "At least one image is required",
      },
    },
    imagePublicId: {
      type: [String],
    },
  },
  { timestamps: true }
);

const PaymentMethod = mongoose.model("PaymentMethod", paymentMethodSchema);

export default PaymentMethod;
