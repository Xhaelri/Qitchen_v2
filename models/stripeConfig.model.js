// stripeConfig.model.js
// ✅ Provider-specific settings ONLY - Activation is in PaymentMethod model
import mongoose from "mongoose";

const stripeConfigSchema = new mongoose.Schema(
  {
    // ==================== ORDER AMOUNT SETTINGS ====================
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
      description: "Minimum order amount in currency units",
    },
    maxOrderAmount: {
      type: Number,
      default: 10000,
      min: 0,
      description: "Maximum order amount in currency units",
    },

    // ==================== CURRENCY SETTINGS ====================
    currency: {
      type: String,
      default: "usd",
      lowercase: true,
      description: "Default currency code (lowercase, e.g., usd, eur, gbp)",
    },
    supportedCurrencies: {
      type: [String],
      default: ["usd"],
      description: "List of supported currencies",
    },

    // ==================== REFUND SETTINGS ====================
    refundWindowHours: {
      type: Number,
      default: 24,
      min: 0,
      description: "Hours after payment within which refunds are allowed (0 = no limit)",
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
    refundReasons: {
      type: [String],
      default: ["requested_by_customer", "duplicate", "fraudulent"],
      description: "Allowed refund reasons",
    },

    // ==================== CHECKOUT SETTINGS ====================
    checkoutMode: {
      type: String,
      default: "payment",
      enum: ["payment", "subscription", "setup"],
      description: "Checkout session mode",
    },
    useStripeCheckout: {
      type: Boolean,
      default: true,
      description: "Use Stripe hosted checkout (true) or custom form (false)",
    },
    checkoutExpirationMinutes: {
      type: Number,
      default: 30,
      min: 1,
      max: 1440,
      description: "Minutes before checkout session expires",
    },
    allowPromotionCodes: {
      type: Boolean,
      default: false,
      description: "Allow customers to enter promotion codes at checkout",
    },
    collectBillingAddress: {
      type: Boolean,
      default: false,
      description: "Collect billing address at checkout",
    },
    collectShippingAddress: {
      type: Boolean,
      default: false,
      description: "Collect shipping address at checkout",
    },
    collectPhoneNumber: {
      type: Boolean,
      default: false,
      description: "Collect phone number at checkout",
    },

    // ==================== CUSTOMER SETTINGS ====================
    allowGuestCheckout: {
      type: Boolean,
      default: true,
      description: "Allow checkout without creating a Stripe customer",
    },
    createCustomerOnCheckout: {
      type: Boolean,
      default: false,
      description: "Always create Stripe customer on successful checkout",
    },
    saveCardForFutureUse: {
      type: Boolean,
      default: false,
      description: "Save card for future payments (setup_future_usage)",
    },
    setupFutureUsage: {
      type: String,
      default: null,
      enum: [null, "on_session", "off_session"],
      description: "How saved cards can be used in future",
    },

    // ==================== STRIPE PAYMENT OPTIONS ====================
    // These are Stripe-specific sub-options, NOT activation controls
    allowedCardBrands: {
      type: [String],
      default: ["visa", "mastercard", "amex", "discover"],
      description: "Allowed card brands when Card is enabled",
    },
    enableApplePay: {
      type: Boolean,
      default: false,
      description: "Enable Apple Pay in Stripe checkout",
    },
    enableGooglePay: {
      type: Boolean,
      default: false,
      description: "Enable Google Pay in Stripe checkout",
    },
    enableLink: {
      type: Boolean,
      default: false,
      description: "Enable Stripe Link for fast checkout",
    },

    // ==================== 3D SECURE / AUTHENTICATION ====================
    require3DSecure: {
      type: Boolean,
      default: false,
      description: "Require 3D Secure authentication for all card payments",
    },
    radar3DSRequestType: {
      type: String,
      default: "automatic",
      enum: ["automatic", "any", "challenge"],
      description: "When to request 3DS",
    },

    // ==================== CAPTURE SETTINGS ====================
    captureMethod: {
      type: String,
      default: "automatic",
      enum: ["automatic", "manual"],
      description: "Capture method: automatic (immediate) or manual (authorize first)",
    },
    authorizationValidDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 7,
      description: "Days before uncaptured authorization expires",
    },

    // ==================== STATEMENT DESCRIPTOR ====================
    statementDescriptor: {
      type: String,
      default: "",
      maxlength: 22,
      description: "Default statement descriptor (max 22 chars)",
    },
    statementDescriptorSuffix: {
      type: String,
      default: "",
      maxlength: 22,
      description: "Statement descriptor suffix",
    },

    // ==================== RECEIPT SETTINGS ====================
    sendReceipts: {
      type: Boolean,
      default: true,
      description: "Send email receipts to customers",
    },
    receiptEmail: {
      type: String,
      default: "",
      description: "BCC email for receipts (optional)",
    },

    // ==================== WEBHOOK SETTINGS ====================
    webhookEnabled: {
      type: Boolean,
      default: true,
    },
    webhookSecretConfigured: {
      type: Boolean,
      default: false,
      description: "Flag indicating webhook secret is configured in env",
    },
    webhookEvents: {
      type: [String],
      default: [
        "checkout.session.completed",
        "checkout.session.expired",
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "charge.refunded",
      ],
      description: "Webhook events to listen for",
    },

    // ==================== URL SETTINGS ====================
    successUrl: {
      type: String,
      default: "",
      description: "Custom success redirect URL",
    },
    cancelUrl: {
      type: String,
      default: "",
      description: "Custom cancel redirect URL",
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
      description: "Order amount above which delivery is free",
    },

    // ==================== TAX SETTINGS ====================
    automaticTax: {
      type: Boolean,
      default: false,
      description: "Enable Stripe Tax for automatic tax calculation",
    },
    taxBehavior: {
      type: String,
      default: "exclusive",
      enum: ["exclusive", "inclusive"],
      description: "Whether prices include tax",
    },

    // ==================== METADATA SETTINGS ====================
    includeOrderMetadata: {
      type: Boolean,
      default: true,
      description: "Include order details in payment metadata",
    },
    metadataFields: {
      type: [String],
      default: ["orderId", "userId"],
      description: "Fields to include in metadata",
    },

    // ==================== STATUS FLAGS ====================
    isActive: {
      type: Boolean,
      default: true,
      description: "Whether Stripe provider is configured and ready",
    },
    isLiveMode: {
      type: Boolean,
      default: false,
      description: "true = live mode, false = test mode",
    },

    // ==================== METADATA ====================
    lastSyncedAt: {
      type: Date,
      description: "Last time settings were verified with Stripe",
    },
    notes: {
      type: String,
      description: "Admin notes about this configuration",
    },
  },
  { timestamps: true }
);

// ==================== INDEXES ====================
stripeConfigSchema.index({ isActive: 1 });

// ==================== STATIC METHODS ====================

/**
 * Get active Stripe configuration
 */
stripeConfigSchema.statics.getActiveConfig = async function () {
  return this.findOne({ isActive: true });
};

/**
 * Validate order amount against config limits
 */
stripeConfigSchema.statics.validateOrderAmount = async function (amount) {
  const config = await this.findOne({ isActive: true });
  if (!config) return { success: true };

  if (config.minOrderAmount > 0 && amount < config.minOrderAmount) {
    return {
      success: false,
      message: `Minimum order amount is ${config.minOrderAmount} ${config.currency.toUpperCase()}`,
      statusCode: 400,
    };
  }

  if (config.maxOrderAmount > 0 && amount > config.maxOrderAmount) {
    return {
      success: false,
      message: `Maximum order amount is ${config.maxOrderAmount} ${config.currency.toUpperCase()}`,
      statusCode: 400,
    };
  }

  return { success: true };
};

/**
 * Check if refund is allowed for an order
 */
stripeConfigSchema.statics.canRefundOrder = async function (
  orderCreatedAt,
  refundAmount,
  orderTotal
) {
  const config = await this.findOne({ isActive: true });
  if (!config) return { success: true };

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
 * Get payment method types for Stripe API
 * Returns Stripe-specific payment types based on config options
 */
stripeConfigSchema.statics.getStripePaymentMethodTypes = async function () {
  const config = await this.findOne({ isActive: true });
  if (!config) return ["card"];

  const methods = ["card"]; // Card is always included when Stripe is used

  if (config.enableLink) methods.push("link");
  if (config.enableApplePay) methods.push("apple_pay");
  if (config.enableGooglePay) methods.push("google_pay");

  return methods;
};

/**
 * Get checkout session options based on config
 */
stripeConfigSchema.statics.getCheckoutSessionOptions = async function (baseOptions = {}) {
  const config = await this.findOne({ isActive: true });
  if (!config) return baseOptions;

  const options = { ...baseOptions };

  // Payment method types
  options.payment_method_types = await this.getStripePaymentMethodTypes();

  // Customer creation
  if (config.createCustomerOnCheckout) {
    options.customer_creation = "always";
  }

  // Promotion codes
  if (config.allowPromotionCodes) {
    options.allow_promotion_codes = true;
  }

  // Billing address
  if (config.collectBillingAddress) {
    options.billing_address_collection = "required";
  }

  // Phone number
  if (config.collectPhoneNumber) {
    options.phone_number_collection = { enabled: true };
  }

  // Automatic tax
  if (config.automaticTax) {
    options.automatic_tax = { enabled: true };
  }

  // Expiration
  if (config.checkoutExpirationMinutes) {
    const expiresAt = Math.floor(Date.now() / 1000) + config.checkoutExpirationMinutes * 60;
    options.expires_at = expiresAt;
  }

  return options;
};

/**
 * Get payment intent options based on config
 */
stripeConfigSchema.statics.getPaymentIntentOptions = async function (baseOptions = {}) {
  const config = await this.findOne({ isActive: true });
  if (!config) return baseOptions;

  const options = { ...baseOptions };

  if (config.captureMethod) {
    options.capture_method = config.captureMethod;
  }

  if (config.saveCardForFutureUse && config.setupFutureUsage) {
    options.setup_future_usage = config.setupFutureUsage;
  }

  if (config.statementDescriptor) {
    options.statement_descriptor = config.statementDescriptor;
  }

  if (config.statementDescriptorSuffix) {
    options.statement_descriptor_suffix = config.statementDescriptorSuffix;
  }

  return options;
};

/**
 * Get configuration summary for dashboard
 */
stripeConfigSchema.methods.getSummary = function () {
  return {
    mode: this.isLiveMode ? "Live" : "Test",
    currency: this.currency.toUpperCase(),
    orderLimits: {
      min: this.minOrderAmount,
      max: this.maxOrderAmount,
    },
    refundPolicy: {
      windowHours: this.refundWindowHours,
      partialAllowed: this.allowPartialRefunds,
      autoRefund: this.autoRefundOnCancellation,
    },
    features: {
      guestCheckout: this.allowGuestCheckout,
      saveCards: this.saveCardForFutureUse,
      require3DS: this.require3DSecure,
      automaticTax: this.automaticTax,
      applePay: this.enableApplePay,
      googlePay: this.enableGooglePay,
      link: this.enableLink,
    },
  };
};

const StripeConfig = mongoose.model("StripeConfig", stripeConfigSchema);

export default StripeConfig;