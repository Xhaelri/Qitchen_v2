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
    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Cancelled"],
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
    orderStatus: {
      type: String,
      enum: ["Processing", "Paid", "Ready", "On the way", "Received", "Failed"],
      default: "Processing",
      required: true,
    },
  },
  { timestamps: true }
);

orderSchema.plugin(aggregatePaginate);

const Order = mongoose.model("Order", orderSchema);

export default Order;
