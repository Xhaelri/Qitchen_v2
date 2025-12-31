// stripeConfig.controller.js
// ✅ Stripe provider-specific settings ONLY
// ❌ Payment method activation is via PaymentMethod.isActive (NOT here)

import StripeConfig from "../models/stripeConfig.model.js";
import Stripe from "stripe";
import "dotenv/config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ==================== GET CONFIG ====================

/**
 * Get active Stripe configuration
 * GET /api/v2/stripe-config
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
 * PATCH /api/v2/stripe-config
 */
export const updateStripeConfig = async (req, res) => {
  try {
    const updates = req.body;

    // ✅ Provider-specific settings ONLY
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

      // Stripe checkout sub-options (these are Stripe-specific features, NOT main activation)
      "allowedCardBrands",
      "enableApplePay",
      "enableGooglePay",
      "enableLink",

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
    if (
      filteredUpdates.statementDescriptor &&
      filteredUpdates.statementDescriptor.length > 22
    ) {
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

// ==================== VERIFY STRIPE CONNECTION ====================

/**
 * Verify Stripe API connection and get account info
 * GET /api/v2/stripe-config/verify
 */
export const verifyStripeConnection = async (req, res) => {
  try {
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
 * GET /api/v2/stripe-config/balance
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
 * POST /api/v2/stripe-config/reset
 */
export const resetStripeConfig = async (req, res) => {
  try {
    await StripeConfig.deleteMany({});

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
 * GET /api/v2/stripe-config/webhooks
 */
export const getWebhookInfo = async (req, res) => {
  try {
    const config = await StripeConfig.findOne({ isActive: true });
    const baseUrl = process.env.BASE_URL || process.env.API_URL;

    return res.status(200).json({
      success: true,
      data: {
        webhookUrl: `${baseUrl}/api/v2/webhooks/stripe`,
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
  verifyStripeConnection,
  getStripeBalance,
  resetStripeConfig,
  getWebhookInfo,
};
