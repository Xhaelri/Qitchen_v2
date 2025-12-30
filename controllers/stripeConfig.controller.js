import StripeConfig from "../models/stripeConfig.model.js";
import Stripe from "stripe";
import "dotenv/config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ==================== GET CONFIG ====================

/**
 * Get active Stripe configuration
 * GET /api/v2/admin/stripe-config
 */
export const getStripeConfig = async (req, res) => {
  try {
    let config = await StripeConfig.findOne({ isActive: true });

    // Create default config if none exists
    if (!config) {
      config = await StripeConfig.create({
        isActive: true,
        isLiveMode: false,
      });
    }

    return res.status(200).json({
      success: true,
      data: config,
      summary: config.getSummary(),
      message: "Stripe configuration fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching Stripe config:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== UPDATE CONFIG ====================

/**
 * Update Stripe configuration
 * PUT /api/v2/admin/stripe-config
 */
export const updateStripeConfig = async (req, res) => {
  try {
    const updates = req.body;

    // Fields that can be updated
    const allowedFields = [
      // Order amount settings
      "minOrderAmount",
      "maxOrderAmount",
      "currency",
      "supportedCurrencies",

      // Refund settings
      "refundWindowHours",
      "allowPartialRefunds",
      "autoRefundOnCancellation",
      "refundReasons",

      // Checkout settings
      "checkoutMode",
      "useStripeCheckout",
      "checkoutExpirationMinutes",
      "allowPromotionCodes",
      "collectBillingAddress",
      "collectShippingAddress",
      "collectPhoneNumber",

      // Customer settings
      "allowGuestCheckout",
      "createCustomerOnCheckout",
      "saveCardForFutureUse",
      "setupFutureUsage",

      // Payment method settings
      "cardPaymentEnabled",
      "allowedCardBrands",
      "applePayEnabled",
      "googlePayEnabled",
      "linkEnabled",
      "bankTransferEnabled",
      "achDebitEnabled",
      "sepaDebitEnabled",
      "idealEnabled",
      "klarnaEnabled",
      "afterpayEnabled",

      // 3D Secure settings
      "require3DSecure",
      "radar3DSRequestType",

      // Capture settings
      "captureMethod",
      "authorizationValidDays",

      // Statement descriptor
      "statementDescriptor",
      "statementDescriptorSuffix",

      // Receipt settings
      "sendReceipts",
      "receiptEmail",

      // Webhook settings
      "webhookEnabled",
      "webhookSecretConfigured",
      "webhookEvents",

      // URL settings
      "successUrl",
      "cancelUrl",

      // Delivery settings
      "defaultDeliveryFee",
      "freeDeliveryThreshold",

      // Tax settings
      "automaticTax",
      "taxBehavior",

      // Metadata settings
      "includeOrderMetadata",
      "metadataFields",

      // Status flags
      "isActive",
      "isLiveMode",

      // Notes
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

    // Validate statement descriptor length
    if (filteredUpdates.statementDescriptor && filteredUpdates.statementDescriptor.length > 22) {
      return res.status(400).json({
        success: false,
        message: "Statement descriptor cannot exceed 22 characters",
      });
    }

    // Find and update or create config
    let config = await StripeConfig.findOne({ isActive: true });

    if (!config) {
      config = await StripeConfig.create({
        ...filteredUpdates,
        isActive: true,
      });
    } else {
      config = await StripeConfig.findByIdAndUpdate(
        config._id,
        { $set: filteredUpdates },
        { new: true, runValidators: true }
      );
    }

    return res.status(200).json({
      success: true,
      data: config,
      summary: config.getSummary(),
      message: "Stripe configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating Stripe config:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== GET ENABLED PAYMENT METHODS ====================

/**
 * Get list of enabled Stripe payment methods
 * GET /api/v2/admin/stripe-config/payment-methods
 */
export const getEnabledPaymentMethods = async (req, res) => {
  try {
    const config = await StripeConfig.findOne({ isActive: true });

    if (!config) {
      return res.status(200).json({
        success: true,
        data: ["Card"],
        apiTypes: ["card"],
        message: "Using default payment methods",
      });
    }

    const enabledMethods = config.getEnabledPaymentMethods();
    const apiTypes = await StripeConfig.getEnabledPaymentMethodTypes();

    return res.status(200).json({
      success: true,
      data: enabledMethods,
      apiTypes,
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
 * PATCH /api/v2/admin/stripe-config/payment-method/:method
 */
export const togglePaymentMethod = async (req, res) => {
  try {
    const { method } = req.params;
    const { enabled } = req.body;

    const methodFieldMap = {
      card: "cardPaymentEnabled",
      apple_pay: "applePayEnabled",
      google_pay: "googlePayEnabled",
      link: "linkEnabled",
      bank_transfer: "bankTransferEnabled",
      ach_debit: "achDebitEnabled",
      sepa_debit: "sepaDebitEnabled",
      ideal: "idealEnabled",
      klarna: "klarnaEnabled",
      afterpay: "afterpayEnabled",
    };

    const field = methodFieldMap[method];

    if (!field) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method: ${method}. Valid methods: ${Object.keys(methodFieldMap).join(", ")}`,
      });
    }

    let config = await StripeConfig.findOne({ isActive: true });

    if (!config) {
      config = await StripeConfig.create({ isActive: true });
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

// ==================== UPDATE REFUND SETTINGS ====================

/**
 * Update refund settings
 * PUT /api/v2/admin/stripe-config/refund-settings
 */
export const updateRefundSettings = async (req, res) => {
  try {
    const { refundWindowHours, allowPartialRefunds, autoRefundOnCancellation, refundReasons } =
      req.body;

    let config = await StripeConfig.findOne({ isActive: true });

    if (!config) {
      config = await StripeConfig.create({ isActive: true });
    }

    if (refundWindowHours !== undefined) config.refundWindowHours = refundWindowHours;
    if (allowPartialRefunds !== undefined) config.allowPartialRefunds = allowPartialRefunds;
    if (autoRefundOnCancellation !== undefined)
      config.autoRefundOnCancellation = autoRefundOnCancellation;
    if (refundReasons !== undefined) config.refundReasons = refundReasons;

    await config.save();

    return res.status(200).json({
      success: true,
      data: {
        refundWindowHours: config.refundWindowHours,
        allowPartialRefunds: config.allowPartialRefunds,
        autoRefundOnCancellation: config.autoRefundOnCancellation,
        refundReasons: config.refundReasons,
      },
      message: "Refund settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating refund settings:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== UPDATE CHECKOUT SETTINGS ====================

/**
 * Update checkout settings
 * PUT /api/v2/admin/stripe-config/checkout-settings
 */
export const updateCheckoutSettings = async (req, res) => {
  try {
    const {
      checkoutMode,
      useStripeCheckout,
      checkoutExpirationMinutes,
      allowPromotionCodes,
      collectBillingAddress,
      collectShippingAddress,
      collectPhoneNumber,
      successUrl,
      cancelUrl,
    } = req.body;

    let config = await StripeConfig.findOne({ isActive: true });

    if (!config) {
      config = await StripeConfig.create({ isActive: true });
    }

    if (checkoutMode !== undefined) config.checkoutMode = checkoutMode;
    if (useStripeCheckout !== undefined) config.useStripeCheckout = useStripeCheckout;
    if (checkoutExpirationMinutes !== undefined)
      config.checkoutExpirationMinutes = checkoutExpirationMinutes;
    if (allowPromotionCodes !== undefined) config.allowPromotionCodes = allowPromotionCodes;
    if (collectBillingAddress !== undefined) config.collectBillingAddress = collectBillingAddress;
    if (collectShippingAddress !== undefined)
      config.collectShippingAddress = collectShippingAddress;
    if (collectPhoneNumber !== undefined) config.collectPhoneNumber = collectPhoneNumber;
    if (successUrl !== undefined) config.successUrl = successUrl;
    if (cancelUrl !== undefined) config.cancelUrl = cancelUrl;

    await config.save();

    return res.status(200).json({
      success: true,
      data: {
        checkoutMode: config.checkoutMode,
        useStripeCheckout: config.useStripeCheckout,
        checkoutExpirationMinutes: config.checkoutExpirationMinutes,
        allowPromotionCodes: config.allowPromotionCodes,
        collectBillingAddress: config.collectBillingAddress,
        collectShippingAddress: config.collectShippingAddress,
        collectPhoneNumber: config.collectPhoneNumber,
        successUrl: config.successUrl,
        cancelUrl: config.cancelUrl,
      },
      message: "Checkout settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating checkout settings:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== UPDATE SECURITY SETTINGS ====================

/**
 * Update security settings (3DS, capture method)
 * PUT /api/v2/admin/stripe-config/security-settings
 */
export const updateSecuritySettings = async (req, res) => {
  try {
    const { require3DSecure, radar3DSRequestType, captureMethod, authorizationValidDays } =
      req.body;

    let config = await StripeConfig.findOne({ isActive: true });

    if (!config) {
      config = await StripeConfig.create({ isActive: true });
    }

    if (require3DSecure !== undefined) config.require3DSecure = require3DSecure;
    if (radar3DSRequestType !== undefined) config.radar3DSRequestType = radar3DSRequestType;
    if (captureMethod !== undefined) config.captureMethod = captureMethod;
    if (authorizationValidDays !== undefined)
      config.authorizationValidDays = authorizationValidDays;

    await config.save();

    return res.status(200).json({
      success: true,
      data: {
        require3DSecure: config.require3DSecure,
        radar3DSRequestType: config.radar3DSRequestType,
        captureMethod: config.captureMethod,
        authorizationValidDays: config.authorizationValidDays,
      },
      message: "Security settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating security settings:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== VERIFY STRIPE CONNECTION ====================

/**
 * Verify Stripe API connection and get account info
 * GET /api/v2/admin/stripe-config/verify
 */
export const verifyStripeConnection = async (req, res) => {
  try {
    // Attempt to retrieve account info
    const account = await stripe.accounts.retrieve();

    let config = await StripeConfig.findOne({ isActive: true });

    if (config) {
      config.lastSyncedAt = new Date();
      config.isLiveMode = !process.env.STRIPE_SECRET_KEY?.includes("test");
      await config.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        accountId: account.id,
        businessName: account.business_profile?.name,
        country: account.country,
        defaultCurrency: account.default_currency,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        liveMode: !process.env.STRIPE_SECRET_KEY?.includes("test"),
      },
      message: "Stripe connection verified successfully",
    });
  } catch (error) {
    console.error("Stripe verification error:", error);
    return res.status(500).json({
      success: false,
      data: {
        connected: false,
        error: error.message,
      },
      message: "Failed to verify Stripe connection",
    });
  }
};

// ==================== GET STRIPE BALANCE ====================

/**
 * Get Stripe account balance
 * GET /api/v2/admin/stripe-config/balance
 */
export const getStripeBalance = async (req, res) => {
  try {
    const balance = await stripe.balance.retrieve();

    return res.status(200).json({
      success: true,
      data: {
        available: balance.available.map((b) => ({
          amount: b.amount / 100,
          currency: b.currency.toUpperCase(),
        })),
        pending: balance.pending.map((b) => ({
          amount: b.amount / 100,
          currency: b.currency.toUpperCase(),
        })),
        livemode: balance.livemode,
      },
      message: "Balance fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching Stripe balance:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== RESET TO DEFAULTS ====================

/**
 * Reset Stripe configuration to defaults
 * POST /api/v2/admin/stripe-config/reset
 */
export const resetStripeConfig = async (req, res) => {
  try {
    // Delete existing config
    await StripeConfig.deleteMany({});

    // Create new default config
    const config = await StripeConfig.create({
      isActive: true,
      isLiveMode: !process.env.STRIPE_SECRET_KEY?.includes("test"),
    });

    return res.status(200).json({
      success: true,
      data: config,
      summary: config.getSummary(),
      message: "Stripe configuration reset to defaults",
    });
  } catch (error) {
    console.error("Error resetting Stripe config:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== GET WEBHOOK INFO ====================

/**
 * Get webhook configuration info
 * GET /api/v2/admin/stripe-config/webhooks
 */
export const getWebhookInfo = async (req, res) => {
  try {
    const config = await StripeConfig.findOne({ isActive: true });

    const baseUrl = process.env.BASE_URL || process.env.API_URL;

    return res.status(200).json({
      success: true,
      data: {
        webhookUrl: `${baseUrl}/api/v2/stripe/webhook`,
        secretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
        enabledEvents: config?.webhookEvents || [
          "checkout.session.completed",
          "checkout.session.expired",
          "payment_intent.succeeded",
          "payment_intent.payment_failed",
          "charge.refunded",
        ],
        recommendedEvents: [
          "checkout.session.completed",
          "checkout.session.expired",
          "checkout.session.async_payment_succeeded",
          "checkout.session.async_payment_failed",
          "payment_intent.succeeded",
          "payment_intent.payment_failed",
          "payment_intent.canceled",
          "charge.refunded",
          "charge.refund.updated",
          "charge.dispute.created",
        ],
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
  getStripeConfig,
  updateStripeConfig,
  getEnabledPaymentMethods,
  togglePaymentMethod,
  updateRefundSettings,
  updateCheckoutSettings,
  updateSecuritySettings,
  verifyStripeConnection,
  getStripeBalance,
  resetStripeConfig,
  getWebhookInfo,
};
