import mongoose from "mongoose";

const globalDiscountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Exclude specific products or categories from global discount
    excludedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    excludedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
  },
  { timestamps: true }
);

// Static method to get active global discount
globalDiscountSchema.statics.getActiveDiscount = async function() {
  const now = new Date();
  
  const discount = await this.findOne({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ createdAt: -1 }); // Get most recent if multiple
  
  if (!discount) {
    return null;
  }
  
  return {
    discountPercentage: discount.discountPercentage,
    isActive: true,
    name: discount.name,
    excludedProducts: discount.excludedProducts,
    excludedCategories: discount.excludedCategories,
  };
};

const GlobalDiscount = mongoose.model("GlobalDiscount", globalDiscountSchema);

export default GlobalDiscount;
