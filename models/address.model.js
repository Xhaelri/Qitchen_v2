import mongoose, { Schema } from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    governorate: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    buildingNumber: {
      type: Number,
      required: true,
    },
    flatNumber: {
      type: Number,
      required: true,
    },
    position: {
      lon: {
        type: String,
        required: false,
      },
      lat: {
        type: String,
        required: false,
      },
    },
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);

export default Address;
