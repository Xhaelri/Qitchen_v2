import mongoose, { Schema } from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    price: { type: Number, required: true },
    
    // ✅ Sale Price Fields (Product-specific discount)
    salePrice: {
      type: Number,
      min: 0,
      validate: {
        validator: function(value) {
          return !value || value < this.price;
        },
        message: "Sale price must be less than regular price",
      },
    },
    saleStartDate: {
      type: Date,
    },
    saleEndDate: {
      type: Date,
    },
    isOnSale: {
      type: Boolean,
      default: false,
    },
    
    isAvailable: { type: Boolean, default: true },
    ingredients: { type: [String], default: [], required: true },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: function (array) {
          return array.length > 0;
        },
        message: "At least one image is required",
      },
    },
    imagesPublicId: {
      type: [String],
    },
  },
  { timestamps: true }
);

// ✅ Instance method to get effective price
productSchema.methods.getEffectivePrice = function(categoryDiscount = null, globalDiscount = null) {
  const now = new Date();
  
  // Priority 1: Product-specific sale price
  if (
    this.isOnSale && 
    this.salePrice && 
    (!this.saleStartDate || now >= this.saleStartDate) &&
    (!this.saleEndDate || now <= this.saleEndDate)
  ) {
    return {
      price: this.salePrice,
      originalPrice: this.price,
      discount: this.price - this.salePrice,
      discountPercentage: Math.round(((this.price - this.salePrice) / this.price) * 100),
      discountType: 'product',
    };
  }
  
  // Priority 2: Category discount
  if (categoryDiscount && categoryDiscount.isActive) {
    const discountedPrice = this.price * (1 - categoryDiscount.discountPercentage / 100);
    return {
      price: Math.round(discountedPrice * 100) / 100,
      originalPrice: this.price,
      discount: this.price - discountedPrice,
      discountPercentage: categoryDiscount.discountPercentage,
      discountType: 'category',
    };
  }
  
  // Priority 3: Global discount
  if (globalDiscount && globalDiscount.isActive) {
    const discountedPrice = this.price * (1 - globalDiscount.discountPercentage / 100);
    return {
      price: Math.round(discountedPrice * 100) / 100,
      originalPrice: this.price,
      discount: this.price - discountedPrice,
      discountPercentage: globalDiscount.discountPercentage,
      discountType: 'global',
    };
  }
  
  // No discount
  return {
    price: this.price,
    originalPrice: this.price,
    discount: 0,
    discountPercentage: 0,
    discountType: 'none',
  };
};

productSchema.plugin(aggregatePaginate);

const Product =
  mongoose.models.product || mongoose.model("Product", productSchema);

export default Product;
