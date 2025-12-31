// paymentMethod.controller.js
// ✅ PaymentMethod.isActive is the SINGLE SOURCE OF TRUTH for activation

import PaymentMethod from "../models/paymentMethod.model.js";
import StripeConfig from "../models/stripeConfig.model.js";
import PaymobConfig from "../models/paymobConfig.model.js";
import {
  uploadOnCloudinary,
  destroyFromCloudinary,
} from "../utils/cloudinary.js";

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get active payment methods for checkout
 * GET /api/v2/payment-methods
 * Public - No auth required
 */
export const getActivePaymentMethods = async (req, res) => {
  try {
    // ✅ Single source of truth: PaymentMethod.isActive
    const activeMethods = await PaymentMethod.find({ isActive: true }).sort({
      sortOrder: 1,
      name: 1,
    });

    // Check provider readiness (config exists = provider is configured)
    const stripeConfig = await StripeConfig.findOne({ isActive: true });
    const paymobConfig = await PaymobConfig.findOne({ isActive: true });

    // Filter methods based on provider availability
    const availableMethods = activeMethods.filter((method) => {
      if (method.provider === "Stripe" && !stripeConfig) return false;
      if (method.provider === "Paymob" && !paymobConfig) return false;
      return true; // Internal (COD) always available
    });

    return res.status(200).json({
      success: true,
      data: availableMethods,
      count: availableMethods.length,
      message: "Payment methods fetched successfully",
    });
  } catch (error) {
    console.error("Error in getActivePaymentMethods:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all payment methods (for admin dashboard)
 * GET /api/v2/payment-methods/all
 * Admin - JWT + Admin role required
 */
export const getAllPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find().sort({
      sortOrder: 1,
      name: 1,
    });

    // Get provider status for context
    const stripeConfig = await StripeConfig.findOne({ isActive: true });
    const paymobConfig = await PaymobConfig.findOne({ isActive: true });

    return res.status(200).json({
      success: true,
      data: paymentMethods,
      count: paymentMethods.length,
      providerStatus: {
        stripe: {
          configured: !!stripeConfig,
          mode: stripeConfig?.isLiveMode ? "live" : "test",
        },
        paymob: {
          configured: !!paymobConfig,
          mode: paymobConfig?.isLiveMode ? "live" : "test",
        },
      },
      message: "Payment methods fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllPaymentMethods:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create a new payment method
 * POST /api/v2/payment-methods
 * Admin - JWT + Admin role required
 */
export const createPaymentMethod = async (req, res) => {
  try {
    const { name, displayName, description, isActive, provider, sortOrder } =
      req.body || {};

    // Validation
    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: "Name and displayName are required",
      });
    }

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Provider is required (Stripe, Paymob, or Internal)",
      });
    }

    const validNames = [
      "Card",
      "COD",
      "Paymob-Card",
      "Paymob-Wallet",
      "Paymob-Kiosk",
      "Paymob-Installments",
      "Paymob-ValU",
    ];

    if (!validNames.includes(name)) {
      return res.status(400).json({
        success: false,
        message: `Payment method name must be one of: ${validNames.join(", ")}`,
      });
    }

    if (!["Stripe", "Paymob", "Internal"].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: "Provider must be 'Stripe', 'Paymob', or 'Internal'",
      });
    }

    // Check for existing
    const existingMethod = await PaymentMethod.findOne({ name });
    if (existingMethod) {
      return res.status(409).json({
        success: false,
        message: `Payment method '${name}' already exists`,
      });
    }

    // Handle images
    let images = [];
    let imagePublicIds = [];

    if (req.files?.length) {
      for (const file of req.files) {
        const result = await uploadOnCloudinary(
          file.buffer,
          file.originalname,
          "payment-methods"
        );
        images.push(result.secure_url);
        imagePublicIds.push(result.public_id);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "At least one image is required",
      });
    }

    // Create payment method
    const paymentMethod = await PaymentMethod.create({
      name,
      displayName,
      description: description || "",
      isActive:
        isActive !== undefined ? isActive === "true" || isActive === true : true,
      provider,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      image: images,
      imagePublicId: imagePublicIds,
    });

    return res.status(201).json({
      success: true,
      data: paymentMethod,
      message: "Payment method created successfully",
    });
  } catch (error) {
    console.error("Error in createPaymentMethod:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update payment method
 * ✅ This is THE ONLY place to enable/disable payment methods
 * PATCH /api/v2/payment-methods/:paymentMethodId
 * Admin - JWT + Admin role required
 */
export const updatePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const { displayName, description, isActive, provider, sortOrder } =
      req.body || {};

    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    // Update fields
    if (displayName !== undefined) paymentMethod.displayName = displayName;
    if (description !== undefined) paymentMethod.description = description;
    if (sortOrder !== undefined) paymentMethod.sortOrder = parseInt(sortOrder);

    // ✅ isActive is the single source of truth for enabling/disabling
    if (isActive !== undefined) {
      paymentMethod.isActive = isActive === "true" || isActive === true;
    }

    if (provider !== undefined) {
      if (!["Stripe", "Paymob", "Internal"].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: "Provider must be 'Stripe', 'Paymob', or 'Internal'",
        });
      }
      paymentMethod.provider = provider;
    }

    // Handle images
    if (req.files?.length) {
      // Delete old images
      if (paymentMethod.imagePublicId?.length) {
        for (const publicId of paymentMethod.imagePublicId) {
          try {
            await destroyFromCloudinary(publicId);
          } catch (err) {
            console.error("Error deleting old image:", err);
          }
        }
      }

      // Upload new images
      const uploadedImages = [];
      for (const file of req.files) {
        const result = await uploadOnCloudinary(
          file.buffer,
          file.originalname,
          "payment-methods"
        );
        uploadedImages.push(result);
      }

      paymentMethod.image = uploadedImages.map((img) => img.secure_url);
      paymentMethod.imagePublicId = uploadedImages.map((img) => img.public_id);
    }

    await paymentMethod.save();

    return res.status(200).json({
      success: true,
      data: paymentMethod,
      message: "Payment method updated successfully",
    });
  } catch (error) {
    console.error("Error in updatePaymentMethod:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Toggle payment method active status
 * ✅ Quick toggle endpoint - SINGLE SOURCE OF TRUTH
 * PATCH /api/v2/payment-methods/:paymentMethodId/toggle
 * Admin - JWT + Admin role required
 */
export const togglePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const { isActive } = req.body;

    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    // Toggle or set explicit value
    paymentMethod.isActive =
      isActive !== undefined
        ? isActive === "true" || isActive === true
        : !paymentMethod.isActive;

    await paymentMethod.save();

    return res.status(200).json({
      success: true,
      data: {
        id: paymentMethod._id,
        name: paymentMethod.name,
        isActive: paymentMethod.isActive,
      },
      message: `${paymentMethod.name} ${
        paymentMethod.isActive ? "enabled" : "disabled"
      } successfully`,
    });
  } catch (error) {
    console.error("Error in togglePaymentMethod:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete payment method
 * DELETE /api/v2/payment-methods/:paymentMethodId
 * Admin - JWT + Admin role required
 */
export const deletePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    // Delete images from Cloudinary
    if (paymentMethod.imagePublicId?.length) {
      for (const publicId of paymentMethod.imagePublicId) {
        try {
          await destroyFromCloudinary(publicId);
        } catch (err) {
          console.error("Error deleting image:", err);
        }
      }
    }

    await PaymentMethod.findByIdAndDelete(paymentMethodId);

    return res.status(200).json({
      success: true,
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    console.error("Error in deletePaymentMethod:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  // Public
  getActivePaymentMethods,
  
  // Admin
  getAllPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethod,
  deletePaymentMethod,
};
