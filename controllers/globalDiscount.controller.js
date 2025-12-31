// globalDiscount.controller.js
import GlobalDiscount from "../models/globalDiscount.model.js";

/**
 * Create global discount (Admin)
 * POST /api/v2/discount/global
 */
export const createGlobalDiscount = async (req, res) => {
  try {
    const {
      name,
      description,
      discountPercentage,
      startDate,
      endDate,
      excludedProducts,
      excludedCategories,
    } = req.body;

    if (!name || !description || !discountPercentage || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Name, description, discount percentage, and end date are required",
      });
    }

    if (discountPercentage < 0 || discountPercentage > 100) {
      return res.status(400).json({
        success: false,
        message: "Discount percentage must be between 0 and 100",
      });
    }

    // Check if name already exists
    const existing = await GlobalDiscount.findOne({ name });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A global discount with this name already exists",
      });
    }

    const discount = await GlobalDiscount.create({
      name,
      description,
      discountPercentage,
      startDate: startDate || Date.now(),
      endDate,
      excludedProducts: excludedProducts || [],
      excludedCategories: excludedCategories || [],
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      data: discount,
      message: "Global discount created successfully",
    });
  } catch (error) {
    console.error("Error in createGlobalDiscount:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get all global discounts (Admin)
 * GET /api/v2/discount/global
 */
export const getAllGlobalDiscounts = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const discounts = await GlobalDiscount.find(filter)
      .populate("excludedProducts", "name price images")
      .populate("excludedCategories", "name description")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await GlobalDiscount.countDocuments(filter);

    // Check which discount is currently active
    const activeDiscount = await GlobalDiscount.getActiveDiscount();

    return res.status(200).json({
      success: true,
      data: discounts,
      currentActiveDiscount: activeDiscount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limitNum),
        total,
        hasNextPage: skip + discounts.length < total,
        hasPrevPage: parseInt(page) > 1,
      },
      message: "Global discounts fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllGlobalDiscounts:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get active global discount (Public)
 * GET /api/v2/discount/global/active
 */
export const getActiveGlobalDiscount = async (req, res) => {
  try {
    const activeDiscount = await GlobalDiscount.getActiveDiscount();

    if (!activeDiscount) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No active global discount",
      });
    }

    return res.status(200).json({
      success: true,
      data: activeDiscount,
      message: "Active global discount fetched successfully",
    });
  } catch (error) {
    console.error("Error in getActiveGlobalDiscount:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get global discount by ID (Admin)
 * GET /api/v2/discount/global/:discountId
 */
export const getGlobalDiscountById = async (req, res) => {
  try {
    const { discountId } = req.params;

    const discount = await GlobalDiscount.findById(discountId)
      .populate("excludedProducts", "name price images")
      .populate("excludedCategories", "name description");

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Global discount not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: discount,
      message: "Global discount fetched successfully",
    });
  } catch (error) {
    console.error("Error in getGlobalDiscountById:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update global discount (Admin)
 * PATCH /api/v2/discount/global/:discountId
 */
export const updateGlobalDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;
    const updates = req.body;

    // If updating name, check uniqueness
    if (updates.name) {
      const existing = await GlobalDiscount.findOne({
        name: updates.name,
        _id: { $ne: discountId },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "A global discount with this name already exists",
        });
      }
    }

    // Validate discount percentage if provided
    if (updates.discountPercentage !== undefined) {
      if (updates.discountPercentage < 0 || updates.discountPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: "Discount percentage must be between 0 and 100",
        });
      }
    }

    const discount = await GlobalDiscount.findByIdAndUpdate(
      discountId,
      updates,
      { new: true, runValidators: true }
    )
      .populate("excludedProducts", "name price")
      .populate("excludedCategories", "name");

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Global discount not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: discount,
      message: "Global discount updated successfully",
    });
  } catch (error) {
    console.error("Error in updateGlobalDiscount:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Toggle global discount status (Admin)
 * PATCH /api/v2/discount/global/:discountId/toggle
 */
export const toggleGlobalDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;

    const discount = await GlobalDiscount.findById(discountId);
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Global discount not found",
      });
    }

    discount.isActive = !discount.isActive;
    await discount.save();

    return res.status(200).json({
      success: true,
      data: discount,
      message: `Global discount ${discount.isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error in toggleGlobalDiscount:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete global discount (Admin)
 * DELETE /api/v2/discount/global/:discountId
 */
export const deleteGlobalDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;

    const discount = await GlobalDiscount.findByIdAndDelete(discountId);

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Global discount not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Global discount deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteGlobalDiscount:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  createGlobalDiscount,
  getAllGlobalDiscounts,
  getActiveGlobalDiscount,
  getGlobalDiscountById,
  updateGlobalDiscount,
  toggleGlobalDiscount,
  deleteGlobalDiscount,
};
