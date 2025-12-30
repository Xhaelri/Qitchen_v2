import PaymobConfig from "../models/paymobConfig.model.js";

// ==================== GET CONFIG ====================

/**
 * Get active Paymob configuration
 * GET /api/v2/admin/paymob-config
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
 * PUT /api/v2/admin/paymob-config
 */
export const updatePaymobConfig = async (req, res) => {
  try {
    const updates = req.body;

    // Fields that can be updated
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

      // Card payment settings
      "cardPaymentEnabled",
      "cardIntegrationName",
      "saveCardEnabled",
      "require3DSecure",

      // Wallet payment settings
      "walletPaymentEnabled",
      "walletIntegrationName",

      // Kiosk payment settings
      "kioskPaymentEnabled",
      "kioskIntegrationName",
      "kioskExpirationHours",

      // Installments settings
      "installmentsEnabled",
      "installmentsIntegrationName",
      "minInstallmentAmount",

      // BNPL settings
      "valuEnabled",
      "valuIntegrationName",
      "valuMinAmount",
      "souhoolaEnabled",
      "souhoolaIntegrationName",
      "symplEnabled",
      "symplIntegrationName",

      // Apple Pay settings
      "applePayEnabled",
      "applePayIntegrationName",

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

      // Status flags
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

// ==================== GET ENABLED PAYMENT METHODS ====================

/**
 * Get list of enabled Paymob payment methods
 * GET /api/v2/admin/paymob-config/payment-methods
 */
export const getEnabledPaymentMethods = async (req, res) => {
  try {
    const config = await PaymobConfig.findOne({ isActive: true });

    if (!config) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No Paymob configuration found",
      });
    }

    const enabledMethods = config.getEnabledPaymentMethods();

    return res.status(200).json({
      success: true,
      data: enabledMethods,
      message: "Enabled payment methods fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching enabled payment methods:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== TOGGLE PAYMENT METHOD ====================

/**
 * Toggle a specific payment method on/off
 * PATCH /api/v2/admin/paymob-config/payment-method/:method
 */
export const togglePaymentMethod = async (req, res) => {
  try {
    const { method } = req.params;
    const { enabled } = req.body;

    const methodFieldMap = {
      "Paymob-Card": "cardPaymentEnabled",
      "Paymob-Wallet": "walletPaymentEnabled",
      "Paymob-Kiosk": "kioskPaymentEnabled",
      "Paymob-Installments": "installmentsEnabled",
      "Paymob-ValU": "valuEnabled",
      "Paymob-Souhoola": "souhoolaEnabled",
      "Paymob-SYMPL": "symplEnabled",
      "Paymob-ApplePay": "applePayEnabled",
    };

    const field = methodFieldMap[method];

    if (!field) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method: ${method}. Valid methods: ${Object.keys(methodFieldMap).join(", ")}`,
      });
    }

    let config = await PaymobConfig.findOne({ isActive: true });

    if (!config) {
      config = await PaymobConfig.create({ isActive: true });
    }

    config[field] = enabled !== undefined ? enabled : !config[field];
    await config.save();

    return res.status(200).json({
      success: true,
      data: {
        method,
        enabled: config[field],
      },
      message: `${method} ${config[field] ? "enabled" : "disabled"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling payment method:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== UPDATE INTEGRATION NAMES ====================

/**
 * Update integration names for payment methods
 * PUT /api/v2/admin/paymob-config/integrations
 */
export const updateIntegrationNames = async (req, res) => {
  try {
    const {
      cardIntegrationName,
      walletIntegrationName,
      kioskIntegrationName,
      installmentsIntegrationName,
      valuIntegrationName,
      souhoolaIntegrationName,
      symplIntegrationName,
      applePayIntegrationName,
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
    if (souhoolaIntegrationName) config.souhoolaIntegrationName = souhoolaIntegrationName;
    if (symplIntegrationName) config.symplIntegrationName = symplIntegrationName;
    if (applePayIntegrationName) config.applePayIntegrationName = applePayIntegrationName;

    await config.save();

    return res.status(200).json({
      success: true,
      data: {
        cardIntegrationName: config.cardIntegrationName,
        walletIntegrationName: config.walletIntegrationName,
        kioskIntegrationName: config.kioskIntegrationName,
        installmentsIntegrationName: config.installmentsIntegrationName,
        valuIntegrationName: config.valuIntegrationName,
        souhoolaIntegrationName: config.souhoolaIntegrationName,
        symplIntegrationName: config.symplIntegrationName,
        applePayIntegrationName: config.applePayIntegrationName,
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

// ==================== SYNC WITH PAYMOB ====================

/**
 * Sync configuration with Paymob dashboard (placeholder)
 * POST /api/v2/admin/paymob-config/sync
 */
export const syncWithPaymob = async (req, res) => {
  try {
    let config = await PaymobConfig.findOne({ isActive: true });

    if (!config) {
      config = await PaymobConfig.create({ isActive: true });
    }

    // TODO: Implement actual sync with Paymob API
    // This would fetch available integrations from Paymob dashboard

    config.lastSyncedAt = new Date();
    await config.save();

    return res.status(200).json({
      success: true,
      data: config,
      message: "Configuration synced with Paymob",
    });
  } catch (error) {
    console.error("Error syncing with Paymob:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== RESET TO DEFAULTS ====================

/**
 * Reset Paymob configuration to defaults
 * POST /api/v2/admin/paymob-config/reset
 */
export const resetPaymobConfig = async (req, res) => {
  try {
    // Delete existing config
    await PaymobConfig.deleteMany({});

    // Create new default config
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

export default {
  getPaymobConfig,
  updatePaymobConfig,
  getEnabledPaymentMethods,
  togglePaymentMethod,
  updateIntegrationNames,
  syncWithPaymob,
  resetPaymobConfig,
};
