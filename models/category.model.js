import mongoose, { Schema } from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    
    // ✅ Category-wide Discount Fields
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    discountStartDate: {
      type: Date,
    },
    discountEndDate: {
      type: Date,
    },
    isDiscountActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Instance method to check if discount is currently active
categorySchema.methods.getCurrentDiscount = function() {
  if (!this.isDiscountActive || this.discountPercentage <= 0) {
    return null;
  }
  
  const now = new Date();
  
  if (this.discountStartDate && now < this.discountStartDate) {
    return null;
  }
  
  if (this.discountEndDate && now > this.discountEndDate) {
    return null;
  }
  
  return {
    discountPercentage: this.discountPercentage,
    isActive: true,
  };
};

categorySchema.plugin(aggregatePaginate);

const Category = mongoose.model("Category", categorySchema);

export default Category;
