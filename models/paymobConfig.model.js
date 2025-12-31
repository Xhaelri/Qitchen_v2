// paymobConfig.model.js
// ✅ Provider-specific settings ONLY - Activation is in PaymentMethod model
import mongoose from "mongoose";

const paymobConfigSchema = new mongoose.Schema(
  {
    // ==================== ORDER AMOUNT SETTINGS ====================
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
      description: "Minimum order amount in EGP",
    },
    maxOrderAmount: {
      type: Number,
      default: 50000,
      min: 0,
      description: "Maximum order amount in EGP",
    },

    // ==================== CURRENCY SETTINGS ====================
    currency: {
      type: String,
      default: "EGP",
      enum: ["EGP", "USD", "SAR", "AED", "OMR", "PKR"],
      description: "Default currency for transactions",
    },

    // ==================== REFUND SETTINGS ====================
    refundWindowHours: {
      type: Number,
      default: 72,
      min: 0,
      description: "Hours after payment within which refunds are allowed",
    },
    allowPartialRefunds: {
      type: Boolean,
      default: true,
      description: "Allow refunding partial amounts",
    },
    autoRefundOnCancellation: {
      type: Boolean,
      default: false,
      description: "Automatically refund when order is cancelled",
    },

    // ==================== VOID SETTINGS ====================
    allowVoidTransaction: {
      type: Boolean,
      default: true,
      description: "Allow voiding transactions before settlement",
    },
    autoVoidOnCancellation: {
      type: Boolean,
      default: true,
      description: "Auto-void pending transactions when order is cancelled",
    },

    // ==================== CHECKOUT SETTINGS ====================
    checkoutType: {
      type: String,
      default: "hosted",
      enum: ["hosted", "iframe", "pixel"],
      description: "Checkout experience type",
    },

    // ==================== INTEGRATION NAMES ====================
    // These are the integration IDs from Paymob dashboard
    cardIntegrationName: {
      type: String,
      default: "card",
      description: "Integration name for card payments",
    },
    walletIntegrationName: {
      type: String,
      default: "wallet",
      description: "Integration name for wallet payments",
    },
    kioskIntegrationName: {
      type: String,
      default: "kiosk",
      description: "Integration name for kiosk payments",
    },
    installmentsIntegrationName: {
      type: String,
      default: "installments",
      description: "Integration name for installments",
    },
    valuIntegrationName: {
      type: String,
      default: "valu",
      description: "Integration name for ValU BNPL",
    },

    // ==================== CARD PAYMENT OPTIONS ====================
    saveCardEnabled: {
      type: Boolean,
      default: false,
      description: "Allow customers to save cards for future payments",
    },
    require3DSecure: {
      type: Boolean,
      default: true,
      description: "Require 3D Secure authentication for card payments",
    },

    // ==================== KIOSK OPTIONS ====================
    kioskExpirationHours: {
      type: Number,
      default: 24,
      description: "Hours before kiosk payment reference expires",
    },

    // ==================== INSTALLMENTS OPTIONS ====================
    minInstallmentAmount: {
      type: Number,
      default: 500,
      description: "Minimum order amount for installments in EGP",
    },

    // ==================== VALU OPTIONS ====================
    valuMinAmount: {
      type: Number,
      default: 500,
      description: "Minimum order amount for ValU in EGP",
    },

    // ==================== WEBHOOK SETTINGS ====================
    webhookEnabled: {
      type: Boolean,
      default: true,
    },
    webhookSecretConfigured: {
      type: Boolean,
      default: false,
      description: "Flag indicating HMAC secret is configured in env",
    },

    // ==================== TRANSACTION SETTINGS ====================
    transactionExpirationMinutes: {
      type: Number,
      default: 30,
      description: "Minutes before unpaid transaction expires",
    },

    // ==================== CALLBACK URL SETTINGS ====================
    customRedirectUrl: {
      type: String,
      default: "",
      description: "Custom redirect URL after payment",
    },
    customWebhookUrl: {
      type: String,
      default: "",
      description: "Custom webhook URL",
    },

    // ==================== DELIVERY SETTINGS ====================
    defaultDeliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==================== STATUS FLAGS ====================
    isActive: {
      type: Boolean,
      default: true,
      description: "Whether Paymob provider is configured and ready",
    },
    isLiveMode: {
      type: Boolean,
      default: false,
      description: "true = live mode, false = test/sandbox mode",
    },

    // ==================== METADATA ====================
    lastSyncedAt: {
      type: Date,
      description: "Last time settings were synced with Paymob dashboard",
    },
    notes: {
      type: String,
      description: "Admin notes about this configuration",
    },
  },
  { timestamps: true }
);

// ==================== INDEXES ====================
paymobConfigSchema.index({ isActive: 1 });

// ==================== STATIC METHODS ====================

/**
 * Get active Paymob configuration
 */
paymobConfigSchema.statics.getActiveConfig = async function () {
  return this.findOne({ isActive: true });
};

/**
 * Get integration name for a payment method
 * @param {string} paymentMethod - e.g., 'Paymob-Card', 'Paymob-Wallet'
 */
paymobConfigSchema.statics.getIntegrationName = async function (paymentMethod) {
  const config = await this.findOne({ isActive: true });
  if (!config) return null;

  const integrationMap = {
    "Paymob-Card": config.cardIntegrationName,
    "Paymob-Wallet": config.walletIntegrationName,
    "Paymob-Kiosk": config.kioskIntegrationName,
    "Paymob-Installments": config.installmentsIntegrationName,
    "Paymob-ValU": config.valuIntegrationName,
  };

  return integrationMap[paymentMethod] || null;
};

/**
 * Validate order amount against config limits
 * @param {number} amount - Order amount
 * @param {string} paymentMethod - Payment method name (optional)
 */
paymobConfigSchema.statics.validateOrderAmount = async function (amount, paymentMethod) {
  const config = await this.findOne({ isActive: true });
  if (!config) {
    return { success: true };
  }

  if (config.minOrderAmount > 0 && amount < config.minOrderAmount) {
    return {
      success: false,
      message: `Minimum order amount for Paymob is ${config.minOrderAmount} ${config.currency}`,
      statusCode: 400,
    };
  }

  if (config.maxOrderAmount > 0 && amount > config.maxOrderAmount) {
    return {
      success: false,
      message: `Maximum order amount for Paymob is ${config.maxOrderAmount} ${config.currency}`,
      statusCode: 400,
    };
  }

  // Check installment minimum if applicable
  if (paymentMethod === "Paymob-Installments" && amount < config.minInstallmentAmount) {
    return {
      success: false,
      message: `Minimum amount for installments is ${config.minInstallmentAmount} ${config.currency}`,
      statusCode: 400,
    };
  }

  // Check ValU minimum if applicable
  if (paymentMethod === "Paymob-ValU" && amount < config.valuMinAmount) {
    return {
      success: false,
      message: `Minimum amount for ValU is ${config.valuMinAmount} ${config.currency}`,
      statusCode: 400,
    };
  }

  return { success: true };
};

/**
 * Check if refund is allowed for an order
 */
paymobConfigSchema.statics.canRefundOrder = async function (orderCreatedAt, refundAmount, orderTotal) {
  const config = await this.findOne({ isActive: true });
  if (!config) {
    return { success: true };
  }

  // Check refund window
  if (config.refundWindowHours > 0) {
    const orderDate = new Date(orderCreatedAt);
    const now = new Date();
    const hoursSinceOrder = (now - orderDate) / (1000 * 60 * 60);

    if (hoursSinceOrder > config.refundWindowHours) {
      return {
        success: false,
        message: `Refund window of ${config.refundWindowHours} hours has expired`,
        statusCode: 400,
      };
    }
  }

  // Check partial refund
  if (refundAmount && refundAmount < orderTotal && !config.allowPartialRefunds) {
    return {
      success: false,
      message: "Partial refunds are not allowed",
      statusCode: 400,
    };
  }

  return { success: true };
};

/**
 * Get configuration summary for dashboard
 */
paymobConfigSchema.methods.getSummary = function () {
  return {
    mode: this.isLiveMode ? "Live" : "Test",
    currency: this.currency,
    orderLimits: {
      min: this.minOrderAmount,
      max: this.maxOrderAmount,
    },
    refundPolicy: {
      windowHours: this.refundWindowHours,
      partialAllowed: this.allowPartialRefunds,
      autoRefund: this.autoRefundOnCancellation,
    },
    integrations: {
      card: this.cardIntegrationName,
      wallet: this.walletIntegrationName,
      kiosk: this.kioskIntegrationName,
      installments: this.installmentsIntegrationName,
      valu: this.valuIntegrationName,
    },
    features: {
      saveCards: this.saveCardEnabled,
      require3DS: this.require3DSecure,
      voidTransactions: this.allowVoidTransaction,
    },
  };
};

const PaymobConfig = mongoose.model("PaymobConfig", paymobConfigSchema);

export default PaymobConfig;