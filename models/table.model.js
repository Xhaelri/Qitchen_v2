import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    capacity: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ✅ Virtual field for reservations
tableSchema.virtual("reservations", {
  ref: "Reservation",
  localField: "_id", 
  foreignField: "table", 
});

tableSchema.set("toObject", { virtuals: true });
tableSchema.set("toJSON", { virtuals: true });

const Table = mongoose.model("Table", tableSchema);
export default Table;
