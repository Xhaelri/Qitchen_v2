import mongoose, { Schema } from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "freeDelivery"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: function() {
        return this.discountType !== "freeDelivery";
      },
      min: 0,
    },
    // Maximum discount amount (for percentage discounts)
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Usage limits
    maxUsageCount: {
      type: Number,
      default: null, // null = unlimited
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    maxUsagePerUser: {
      type: Number,
      default: 1,
    },
    // User-specific usage tracking
    usedBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        count: {
          type: Number,
          default: 1,
        },
      },
    ],
    // Validity period
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    // Scope restrictions
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    // If true, coupon applies to all products
    isGlobal: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Instance method to check if coupon is valid
couponSchema.methods.isValid = function() {
  const now = new Date();
  
  // Check if active
  if (!this.isActive) {
    return { valid: false, message: "Coupon is not active" };
  }
  
  // Check date validity
  if (now < this.startDate) {
    return { valid: false, message: "Coupon is not yet active" };
  }
  
  if (now > this.expiryDate) {
    return { valid: false, message: "Coupon has expired" };
  }
  
  // Check usage limit
  if (this.maxUsageCount && this.usageCount >= this.maxUsageCount) {
    return { valid: false, message: "Coupon usage limit reached" };
  }
  
  return { valid: true };
};

// Instance method to check if user can use coupon
couponSchema.methods.canUserUse = function(userId) {
  if (!userId) return { canUse: false, message: "User ID required" };
  
  const userUsage = this.usedBy.find(
    (entry) => entry.user.toString() === userId.toString()
  );
  
  if (userUsage && userUsage.count >= this.maxUsagePerUser) {
    return { 
      canUse: false, 
      message: `You have already used this coupon ${this.maxUsagePerUser} time(s)` 
    };
  }
  
  return { canUse: true };
};

// Instance method to increment usage
couponSchema.methods.incrementUsage = async function(userId) {
  this.usageCount += 1;
  
  const userUsage = this.usedBy.find(
    (entry) => entry.user.toString() === userId.toString()
  );
  
  if (userUsage) {
    userUsage.count += 1;
  } else {
    this.usedBy.push({ user: userId, count: 1 });
  }
  
  await this.save();
};

// Static method to find valid coupon by code
couponSchema.statics.findValidCoupon = async function(code) {
  const coupon = await this.findOne({ 
    code: code.toUpperCase(),
    isActive: true,
  });
  
  if (!coupon) {
    return { success: false, message: "Invalid coupon code" };
  }
  
  const validity = coupon.isValid();
  if (!validity.valid) {
    return { success: false, message: validity.message };
  }
  
  return { success: true, coupon };
};

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
