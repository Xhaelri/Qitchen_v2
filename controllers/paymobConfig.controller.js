// paymobConfig.controller.js
// ✅ Paymob provider-specific settings ONLY
// ❌ Payment method activation is via PaymentMethod.isActive (NOT here)

import PaymobConfig from "../models/paymobConfig.model.js";

// ==================== GET CONFIG ====================

/**
 * Get active Paymob configuration
 * GET /api/v2/paymob-config
 */
export const getPaymobConfig = async (req, res) => {
  try {
    let config = await PaymobConfig.findOne({ isActive: true });

    // Create default config if none exists
    if (!config) {
      config = await PaymobConfig.create({
        isActive: true,
        isLiveMode: false,
      });
    }

    return res.status(200).json({
      success: true,
      data: config,
      summary: config.getSummary ? config.getSummary() : null,
      message: "Paymob configuration fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching Paymob config:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== UPDATE CONFIG ====================

/**
 * Update Paymob configuration
 * PATCH /api/v2/paymob-config
 */
export const updatePaymobConfig = async (req, res) => {
  try {
    const updates = req.body;

    // ✅ Provider-specific settings ONLY
    // ❌ NO activation fields (cardPaymentEnabled, walletPaymentEnabled, etc.)
    const allowedFields = [
      // Order amount settings
      "minOrderAmount",
      "maxOrderAmount",
      "currency",

      // Refund settings
      "refundWindowHours",
      "allowPartialRefunds",
      "autoRefundOnCancellation",

      // Void settings
      "allowVoidTransaction",
      "autoVoidOnCancellation",

      // Checkout settings
      "checkoutType",

      // Integration names (from Paymob dashboard)
      "cardIntegrationName",
      "walletIntegrationName",
      "kioskIntegrationName",
      "installmentsIntegrationName",
      "valuIntegrationName",

      // Card payment options (NOT activation)
      "saveCardEnabled",
      "require3DSecure",

      // Kiosk options
      "kioskExpirationHours",

      // Installments options
      "minInstallmentAmount",

      // ValU options
      "valuMinAmount",

      // Webhook settings
      "webhookEnabled",
      "webhookSecretConfigured",

      // Transaction settings
      "transactionExpirationMinutes",

      // Callback URL settings
      "customRedirectUrl",
      "customWebhookUrl",

      // Delivery settings
      "defaultDeliveryFee",
      "freeDeliveryThreshold",

      // Status flags (provider ready, NOT payment method activation)
      "isActive",
      "isLiveMode",

      // Metadata
      "notes",
    ];

    // Filter updates to only allowed fields
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    // Validation
    if (filteredUpdates.minOrderAmount !== undefined && filteredUpdates.minOrderAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Minimum order amount cannot be negative",
      });
    }

    if (filteredUpdates.maxOrderAmount !== undefined && filteredUpdates.maxOrderAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Maximum order amount cannot be negative",
      });
    }

    // Find and update or create config
    let config = await PaymobConfig.findOne({ isActive: true });

    if (!config) {
      config = await PaymobConfig.create({
        ...filteredUpdates,
        isActive: true,
      });
    } else {
      config = await PaymobConfig.findByIdAndUpdate(
        config._id,
        { $set: filteredUpdates },
        { new: true, runValidators: true }
      );
    }

    return res.status(200).json({
      success: true,
      data: config,
      message: "Paymob configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating Paymob config:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== UPDATE INTEGRATION NAMES ====================

/**
 * Update integration names for payment methods
 * PUT /api/v2/paymob-config/integrations
 */
export const updateIntegrationNames = async (req, res) => {
  try {
    const {
      cardIntegrationName,
      walletIntegrationName,
      kioskIntegrationName,
      installmentsIntegrationName,
      valuIntegrationName,
    } = req.body;

    let config = await PaymobConfig.findOne({ isActive: true });

    if (!config) {
      config = await PaymobConfig.create({ isActive: true });
    }

    // Update only provided integration names
    if (cardIntegrationName) config.cardIntegrationName = cardIntegrationName;
    if (walletIntegrationName) config.walletIntegrationName = walletIntegrationName;
    if (kioskIntegrationName) config.kioskIntegrationName = kioskIntegrationName;
    if (installmentsIntegrationName) config.installmentsIntegrationName = installmentsIntegrationName;
    if (valuIntegrationName) config.valuIntegrationName = valuIntegrationName;

    await config.save();

    return res.status(200).json({
      success: true,
      data: {
        cardIntegrationName: config.cardIntegrationName,
        walletIntegrationName: config.walletIntegrationName,
        kioskIntegrationName: config.kioskIntegrationName,
        installmentsIntegrationName: config.installmentsIntegrationName,
        valuIntegrationName: config.valuIntegrationName,
      },
      message: "Integration names updated successfully",
    });
  } catch (error) {
    console.error("Error updating integration names:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ==================== RESET TO DEFAULTS ====================

/**
 * Reset Paymob configuration to defaults
 * POST /api/v2/paymob-config/reset
 */
export const resetPaymobConfig = async (req, res) => {
  try {
    await PaymobConfig.deleteMany({});

    const config = await PaymobConfig.create({
      isActive: true,
      isLiveMode: false,
    });

    return res.status(200).json({
      success: true,
      data: config,
      message: "Paymob configuration reset to defaults",
    });
  } catch (error) {
    console.error("Error resetting Paymob config:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== GET WEBHOOK INFO ====================

/**
 * Get webhook configuration info
 * GET /api/v2/paymob-config/webhooks
 */
export const getWebhookInfo = async (req, res) => {
  try {
    const config = await PaymobConfig.findOne({ isActive: true });
    const baseUrl = process.env.BASE_URL || process.env.API_URL;

    return res.status(200).json({
      success: true,
      data: {
        webhookUrl: `${baseUrl}/api/v2/webhooks/paymob`,
        secretConfigured: !!process.env.PAYMOB_HMAC_SECRET,
        redirectUrl: config?.customRedirectUrl || `${process.env.FRONT_PRODUCTION_URL || process.env.CLIENT_URL}/payment-redirect`,
        transactionExpiration: config?.transactionExpirationMinutes || 30,
      },
      message: "Webhook info fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching webhook info:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  getPaymobConfig,
  updatePaymobConfig,
  updateIntegrationNames,
  resetPaymobConfig,
  getWebhookInfo,
};
