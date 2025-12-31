// coupon.controller.js
import Coupon from "../models/coupon.model.js";

// ==================== ADMIN COUPON MANAGEMENT ====================

/**
 * Create new coupon (Admin)
 * POST /api/v2/coupon/create
 */
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      maxUsageCount,
      maxUsagePerUser,
      startDate,
      expiryDate,
      applicableProducts,
      applicableCategories,
      isGlobal,
    } = req.body;

    // Validate required fields
    if (!code || !description || !discountType || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Code, description, discount type, and expiry date are required",
      });
    }

    // Validate discount value for non-freeDelivery types
    if (discountType !== "freeDelivery" && (!discountValue || discountValue <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Discount value is required and must be positive",
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue: discountType !== "freeDelivery" ? discountValue : undefined,
      maxDiscountAmount,
      minOrderAmount: minOrderAmount || 0,
      maxUsageCount,
      maxUsagePerUser: maxUsagePerUser || 1,
      startDate: startDate || Date.now(),
      expiryDate,
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
      isGlobal: isGlobal !== undefined ? isGlobal : true,
    });

    return res.status(201).json({
      success: true,
      data: coupon,
      message: "Coupon created successfully",
    });
  } catch (error) {
    console.error("Error in createCoupon:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get all coupons (Admin)
 * GET /api/v2/coupon/all
 */
export const getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const coupons = await Coupon.find(filter)
      .populate("applicableProducts", "name price")
      .populate("applicableCategories", "name")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await Coupon.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: coupons,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limitNum),
        total,
        hasNextPage: skip + coupons.length < total,
        hasPrevPage: parseInt(page) > 1,
      },
      message: "Coupons fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllCoupons:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get coupon by ID (Admin)
 * GET /api/v2/coupon/:couponId
 */
export const getCouponById = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId)
      .populate("applicableProducts", "name price images")
      .populate("applicableCategories", "name description");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Add usage statistics
    const stats = {
      totalUsage: coupon.usageCount,
      remainingUsage: coupon.maxUsageCount 
        ? coupon.maxUsageCount - coupon.usageCount 
        : "Unlimited",
      uniqueUsers: coupon.usedBy.length,
    };

    return res.status(200).json({
      success: true,
      data: {
        ...coupon.toObject(),
        stats,
      },
      message: "Coupon fetched successfully",
    });
  } catch (error) {
    console.error("Error in getCouponById:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update coupon (Admin)
 * PATCH /api/v2/coupon/:couponId
 */
export const updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const updates = req.body;

    // Don't allow updating usage count or usedBy directly
    delete updates.usageCount;
    delete updates.usedBy;

    // If updating code, ensure it's unique
    if (updates.code) {
      const existing = await Coupon.findOne({ 
        code: updates.code.toUpperCase(),
        _id: { $ne: couponId },
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }
      updates.code = updates.code.toUpperCase();
    }

    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      updates,
      { new: true, runValidators: true }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: coupon,
      message: "Coupon updated successfully",
    });
  } catch (error) {
    console.error("Error in updateCoupon:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Toggle coupon active status (Admin)
 * PATCH /api/v2/coupon/:couponId/toggle
 */
export const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return res.status(200).json({
      success: true,
      data: coupon,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error in toggleCouponStatus:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete coupon (Admin)
 * DELETE /api/v2/coupon/:couponId
 */
export const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findByIdAndDelete(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteCoupon:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== CUSTOMER COUPON OPERATIONS ====================

/**
 * Validate and get coupon details (Customer)
 * GET /api/v2/coupon/validate/:code
 */
export const validateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user?._id;

    const result = await Coupon.findValidCoupon(code);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    const coupon = result.coupon;

    // Check if user can use this coupon
    const userCheck = coupon.canUserUse(userId);
    if (!userCheck.canUse) {
      return res.status(400).json({
        success: false,
        message: userCheck.message,
      });
    }

    // Return coupon details (without sensitive info)
    return res.status(200).json({
      success: true,
      data: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderAmount: coupon.minOrderAmount,
        expiryDate: coupon.expiryDate,
      },
      message: "Coupon is valid",
    });
  } catch (error) {
    console.error("Error in validateCoupon:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  validateCoupon,
};
