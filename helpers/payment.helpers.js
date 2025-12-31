// payment.helpers.js
// ✅ Single source of truth: PaymentMethod.isActive
import DeliveryLocation from "../models/deliveryLocation.model.js";
import PaymentMethod from "../models/paymentMethod.model.js";
import StripeConfig from "../models/stripeConfig.model.js";
import PaymobConfig from "../models/paymobConfig.model.js";

// ==================== PAYMENT METHOD VALIDATION ====================

/**
 * Validate payment method is active
 * ✅ Single source of truth: PaymentMethod.isActive
 * @param {string} paymentMethodName
 * @returns {Promise<ValidationResult>}
 */
export const validatePaymentMethod = async (paymentMethodName) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      name: paymentMethodName,
    });

    if (!paymentMethod) {
      return {
        success: false,
        message: `Payment method '${paymentMethodName}' not found`,
        statusCode: 404,
      };
    }

    // ✅ SINGLE CHECK - PaymentMethod.isActive is the only source of truth
    if (!paymentMethod.isActive) {
      return {
        success: false,
        message: `${paymentMethodName} is currently unavailable. Please choose another payment method.`,
        statusCode: 400,
      };
    }

    // Check if provider config exists and is active (for provider readiness)
    const providerCheck = await checkProviderReady(paymentMethodName);
    if (!providerCheck.success) {
      return providerCheck;
    }

    return {
      success: true,
      paymentMethod,
    };
  } catch (error) {
    console.error("Error validating payment method:", error);
    return {
      success: false,
      message: "Error validating payment method",
      statusCode: 500,
    };
  }
};

/**
 * Check if payment provider is configured and ready
 * This checks if the provider (Stripe/Paymob) has valid config, NOT activation
 * @param {string} paymentMethodName
 * @returns {Promise<ValidationResult>}
 */
export const checkProviderReady = async (paymentMethodName) => {
  const provider = getPaymentProvider(paymentMethodName);

  if (provider === "stripe") {
    const config = await StripeConfig.findOne({ isActive: true });
    if (!config) {
      return {
        success: false,
        message: "Stripe payment gateway is not configured. Please contact support.",
        statusCode: 503,
      };
    }
  }

  if (provider === "paymob") {
    const config = await PaymobConfig.findOne({ isActive: true });
    if (!config) {
      return {
        success: false,
        message: "Paymob payment gateway is not configured. Please contact support.",
        statusCode: 503,
      };
    }
  }

  // COD (Internal) doesn't need external config
  return { success: true };
};

// ==================== PAYMENT GATEWAY HELPERS ====================

/**
 * Check if payment method requires external gateway
 * @param {string} paymentMethod
 * @returns {boolean}
 */
export const isExternalPaymentGateway = (paymentMethod) => {
  return [
    "Card",
    "Paymob-Card",
    "Paymob-Wallet",
    "Paymob-Kiosk",
    "Paymob-Installments",
    "Paymob-ValU",
  ].includes(paymentMethod);
};

/**
 * Get payment gateway type
 * @param {string} paymentMethod
 * @returns {string} - 'Stripe', 'Paymob', or 'Internal'
 */
export const getPaymentGateway = (paymentMethod) => {
  if (paymentMethod === "Card") return "Stripe";
  if (paymentMethod.startsWith("Paymob-")) return "Paymob";
  return "Internal";
};

/**
 * Get payment provider name (lowercase)
 * @param {string} paymentMethod
 * @returns {string}
 */
export const getPaymentProvider = (paymentMethod) => {
  if (paymentMethod === "Card") return "stripe";
  if (paymentMethod.startsWith("Paymob-")) return "paymob";
  if (paymentMethod === "COD") return "cod";
  return "unknown";
};

// ==================== DELIVERY FEE CALCULATION ====================

/**
 * Calculate delivery fee based on location and order subtotal
 * @param {string} placeType - 'Online', 'In-Place', or 'Takeaway'
 * @param {string} governorate
 * @param {string} city
 * @param {number} subtotal
 * @returns {Promise<number>}
 */
export const calculateDeliveryFee = async (
  placeType,
  governorate,
  city,
  subtotal
) => {
  if (placeType !== "Online") {
    return 0; // No delivery fee for In-Place or Takeaway
  }

  if (!governorate || !city) {
    throw new Error("Governorate and city are required for online orders");
  }

  const location = await DeliveryLocation.findOne({
    governorate,
    city,
    isActive: true,
  });

  if (!location) {
    throw new Error(`Delivery not available for ${city}, ${governorate}`);
  }

  // Check for free delivery threshold from either config
  const stripeConfig = await StripeConfig.findOne({ isActive: true });
  const paymobConfig = await PaymobConfig.findOne({ isActive: true });

  // Use the higher threshold if both exist
  let freeDeliveryThreshold = 0;
  if (stripeConfig?.freeDeliveryThreshold) {
    freeDeliveryThreshold = stripeConfig.freeDeliveryThreshold;
  }
  if (
    paymobConfig?.freeDeliveryThreshold &&
    paymobConfig.freeDeliveryThreshold > freeDeliveryThreshold
  ) {
    freeDeliveryThreshold = paymobConfig.freeDeliveryThreshold;
  }

  if (freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold) {
    return 0;
  }

  return location.deliveryFee;
};

// ==================== ORDER AMOUNT VALIDATION ====================

/**
 * Validate order amount against config limits
 * Uses the appropriate config based on payment method
 * @param {number} totalPrice
 * @param {string} paymentMethod - Payment method name
 * @returns {Promise<ValidationResult>}
 */
export const validateOrderAmount = async (totalPrice, paymentMethod = null) => {
  let config = null;

  // Get relevant config based on payment method
  if (paymentMethod && paymentMethod.startsWith("Paymob-")) {
    config = await PaymobConfig.findOne({ isActive: true });

    if (config) {
      const validation = await PaymobConfig.validateOrderAmount(
        totalPrice,
        paymentMethod
      );
      if (!validation.success) {
        return validation;
      }
    }
  } else if (paymentMethod === "Card") {
    config = await StripeConfig.findOne({ isActive: true });

    if (config) {
      const validation = await StripeConfig.validateOrderAmount(totalPrice);
      if (!validation.success) {
        return validation;
      }
    }
  }

  // For COD or unknown, use general limits from StripeConfig
  if (!config) {
    config = await StripeConfig.findOne({ isActive: true });
  }

  if (config) {
    if (config.minOrderAmount > 0 && totalPrice < config.minOrderAmount) {
      return {
        success: false,
        message: `Minimum order amount is ${config.minOrderAmount}`,
        statusCode: 400,
      };
    }

    if (config.maxOrderAmount > 0 && totalPrice > config.maxOrderAmount) {
      return {
        success: false,
        message: `Maximum order amount is ${config.maxOrderAmount}`,
        statusCode: 400,
      };
    }
  }

  return { success: true };
};

// ==================== PAYMENT METHOD ID ====================

/**
 * Get PaymentMethod ObjectId from name
 * @param {string} paymentMethodName
 * @returns {Promise<ObjectId>}
 * @throws {Error} If payment method not found
 */
export async function getPaymentMethodId(paymentMethodName) {
  const paymentMethod = await PaymentMethod.findOne({
    name: paymentMethodName,
  });
  if (!paymentMethod) {
    throw new Error(`Payment method '${paymentMethodName}' not found`);
  }
  return paymentMethod._id;
}

// ==================== REFUND VALIDATION ====================

/**
 * Check if refund is allowed for an order
 * @param {Object} order - The order document
 * @param {number} refundAmount - Amount to refund (optional for full refund)
 * @returns {Promise<ValidationResult>}
 */
export const validateRefundRequest = async (order, refundAmount = null) => {
  // Get payment method name from order
  const paymentMethodName = order.paymentMethod?.name || "";
  const provider = getPaymentProvider(paymentMethodName);

  let config = null;

  if (provider === "paymob") {
    config = await PaymobConfig.findOne({ isActive: true });

    if (config) {
      return PaymobConfig.canRefundOrder(
        order.createdAt,
        refundAmount || order.totalPrice,
        order.totalPrice
      );
    }
  } else if (provider === "stripe") {
    config = await StripeConfig.findOne({ isActive: true });

    if (config) {
      return StripeConfig.canRefundOrder(
        order.createdAt,
        refundAmount || order.totalPrice,
        order.totalPrice
      );
    }
  }

  // COD - no refund validation needed
  if (provider === "cod") {
    return { success: true };
  }

  // No config = allow refund
  return { success: true };
};

// ==================== CONFIG GETTERS ====================

/**
 * Get active Stripe config
 * @returns {Promise<Object|null>}
 */
export const getStripeConfig = async () => {
  return StripeConfig.findOne({ isActive: true });
};

/**
 * Get active Paymob config
 * @returns {Promise<Object|null>}
 */
export const getPaymobConfig = async () => {
  return PaymobConfig.findOne({ isActive: true });
};

/**
 * Get config for a specific payment method
 * @param {string} paymentMethod
 * @returns {Promise<Object|null>}
 */
export const getConfigForPaymentMethod = async (paymentMethod) => {
  if (paymentMethod === "Card") {
    return getStripeConfig();
  }
  if (paymentMethod.startsWith("Paymob-")) {
    return getPaymobConfig();
  }
  // COD and others use Stripe config for general settings
  return getStripeConfig();
};

// ==================== ACTIVE PAYMENT METHODS ====================

/**
 * Get all active payment methods with provider readiness check
 * @returns {Promise<Array>}
 */
export const getActivePaymentMethods = async () => {
  // Get all active payment methods from database
  const activeMethods = await PaymentMethod.find({ isActive: true }).sort({
    sortOrder: 1,
    name: 1,
  });

  // Check provider readiness for each
  const availableMethods = [];

  for (const method of activeMethods) {
    const providerCheck = await checkProviderReady(method.name);
    if (providerCheck.success) {
      availableMethods.push(method);
    }
  }

  return availableMethods;
};

export default {
  validatePaymentMethod,
  checkProviderReady,
  isExternalPaymentGateway,
  getPaymentGateway,
  getPaymentProvider,
  calculateDeliveryFee,
  validateOrderAmount,
  getPaymentMethodId,
  validateRefundRequest,
  getStripeConfig,
  getPaymobConfig,
  getConfigForPaymentMethod,
  getActivePaymentMethods,
};