// paymobConfig.model.js
import mongoose from "mongoose";

const paymobConfigSchema = new mongoose.Schema(
  {
    // ==================== API CREDENTIALS ====================
    // Note: Sensitive credentials should be in .env, but these flags control behavior
    
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
      default: 72,  // Paymob typically allows refunds within 72 hours
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
      description: "Allow voiding transactions (same-day cancellation before settlement)",
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
      description: "Checkout experience type: hosted (redirect), iframe (embedded), pixel (native)",
    },
    
    // ==================== CARD PAYMENT SETTINGS ====================
    cardPaymentEnabled: {
      type: Boolean,
      default: true,
      description: "Enable card payments (Visa, Mastercard, Meeza)",
    },
    cardIntegrationName: {
      type: String,
      default: "card",
      description: "Integration name for card payments from Paymob dashboard",
    },
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
    
    // ==================== WALLET PAYMENT SETTINGS ====================
    walletPaymentEnabled: {
      type: Boolean,
      default: true,
      description: "Enable mobile wallet payments (Vodafone Cash, Orange, Etisalat, etc.)",
    },
    walletIntegrationName: {
      type: String,
      default: "wallet",
      description: "Integration name for wallet payments from Paymob dashboard",
    },
    
    // ==================== KIOSK PAYMENT SETTINGS ====================
    kioskPaymentEnabled: {
      type: Boolean,
      default: false,
      description: "Enable kiosk payments (Aman, Masary)",
    },
    kioskIntegrationName: {
      type: String,
      default: "kiosk",
      description: "Integration name for kiosk payments",
    },
    kioskExpirationHours: {
      type: Number,
      default: 24,
      description: "Hours before kiosk payment reference expires",
    },
    
    // ==================== INSTALLMENTS SETTINGS ====================
    installmentsEnabled: {
      type: Boolean,
      default: false,
      description: "Enable bank installment payments",
    },
    installmentsIntegrationName: {
      type: String,
      default: "installments",
      description: "Integration name for installments",
    },
    minInstallmentAmount: {
      type: Number,
      default: 500,
      description: "Minimum order amount for installments in EGP",
    },
    
    // ==================== BNPL (BUY NOW PAY LATER) SETTINGS ====================
    // ValU
    valuEnabled: {
      type: Boolean,
      default: false,
      description: "Enable ValU BNPL payments",
    },
    valuIntegrationName: {
      type: String,
      default: "valu",
    },
    valuMinAmount: {
      type: Number,
      default: 500,
    },
    
    // Souhoola
    souhoolaEnabled: {
      type: Boolean,
      default: false,
      description: "Enable Souhoola BNPL payments",
    },
    souhoolaIntegrationName: {
      type: String,
      default: "souhoola",
    },
    
    // SYMPL
    symplEnabled: {
      type: Boolean,
      default: false,
      description: "Enable SYMPL BNPL payments",
    },
    symplIntegrationName: {
      type: String,
      default: "sympl",
    },
    
    // Other BNPL providers can be added similarly
    // (Aman, Forsa, Halan, Premium, Contact, etc.)
    
    // ==================== APPLE PAY SETTINGS ====================
    applePayEnabled: {
      type: Boolean,
      default: false,
      description: "Enable Apple Pay (requires separate activation with Paymob)",
    },
    applePayIntegrationName: {
      type: String,
      default: "applepay",
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
    // These override env variables if set
    customRedirectUrl: {
      type: String,
      default: "",
      description: "Custom redirect URL after payment (overrides default)",
    },
    customWebhookUrl: {
      type: String,
      default: "",
      description: "Custom webhook URL (overrides default)",
    },
    
    // ==================== DELIVERY SETTINGS ====================
    // Shared with StripeConfig or specific to Paymob
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
    "Paymob-Souhoola": config.souhoolaIntegrationName,
    "Paymob-SYMPL": config.symplIntegrationName,
    "Paymob-ApplePay": config.applePayIntegrationName,
  };
  
  return integrationMap[paymentMethod] || null;
};

/**
 * Check if a payment method is enabled
 */
paymobConfigSchema.statics.isPaymentMethodEnabled = async function (paymentMethod) {
  const config = await this.findOne({ isActive: true });
  if (!config) return false;
  
  const enabledMap = {
    "Paymob-Card": config.cardPaymentEnabled,
    "Paymob-Wallet": config.walletPaymentEnabled,
    "Paymob-Kiosk": config.kioskPaymentEnabled,
    "Paymob-Installments": config.installmentsEnabled,
    "Paymob-ValU": config.valuEnabled,
    "Paymob-Souhoola": config.souhoolaEnabled,
    "Paymob-SYMPL": config.symplEnabled,
    "Paymob-ApplePay": config.applePayEnabled,
  };
  
  return enabledMap[paymentMethod] || false;
};

/**
 * Validate order amount against config limits
 */
paymobConfigSchema.statics.validateOrderAmount = async function (amount, paymentMethod) {
  const config = await this.findOne({ isActive: true });
  if (!config) {
    return { success: true }; // No config = no restrictions
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
    return { success: true }; // No config = allow refund
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

// ==================== INSTANCE METHODS ====================

/**
 * Get all enabled payment methods
 */
paymobConfigSchema.methods.getEnabledPaymentMethods = function () {
  const methods = [];
  
  if (this.cardPaymentEnabled) methods.push("Paymob-Card");
  if (this.walletPaymentEnabled) methods.push("Paymob-Wallet");
  if (this.kioskPaymentEnabled) methods.push("Paymob-Kiosk");
  if (this.installmentsEnabled) methods.push("Paymob-Installments");
  if (this.valuEnabled) methods.push("Paymob-ValU");
  if (this.souhoolaEnabled) methods.push("Paymob-Souhoola");
  if (this.symplEnabled) methods.push("Paymob-SYMPL");
  if (this.applePayEnabled) methods.push("Paymob-ApplePay");
  
  return methods;
};

const PaymobConfig = mongoose.model("PaymobConfig", paymobConfigSchema);

export default PaymobConfig;
