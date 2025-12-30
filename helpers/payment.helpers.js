import DeliveryLocation from "../models/deliveryLocation.model.js";
import PaymentMethod from "../models/paymentMethod.model.js";
import StripeConfig from "../models/stripeConfig.model.js";
import PaymobConfig from "../models/paymobConfig.model.js";

// ==================== PAYMENT METHOD VALIDATION ====================

/**
 * Validate payment method is active and available
 * @param {string} paymentMethodName
 * @returns {Promise<ValidationResult>}
 */
export const validatePaymentMethod = async (paymentMethodName) => {
  try {
    // Check if payment method exists and is active in PaymentMethod collection
    const paymentMethod = await PaymentMethod.findOne({
      name: paymentMethodName,
      isActive: true,
    });

    if (!paymentMethod) {
      return {
        success: false,
        message: `${paymentMethodName} payment method is currently unavailable. Please choose another payment method.`,
        statusCode: 400,
      };
    }

    // Additional validation for Paymob methods
    if (paymentMethodName.startsWith("Paymob-")) {
      const paymobConfig = await PaymobConfig.findOne({ isActive: true });

      if (paymobConfig) {
        const isEnabled = await PaymobConfig.isPaymentMethodEnabled(
          paymentMethodName
        );

        if (!isEnabled) {
          return {
            success: false,
            message: `${paymentMethodName} is currently disabled. Please choose another payment method.`,
            statusCode: 400,
          };
        }
      }
    }

    return {
      success: true,
      paymentMethod,
    };
  } catch (error) {
    return {
      success: false,
      message: "Error validating payment method",
      statusCode: 500,
    };
  }
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
    "Paymob-Souhoola",
    "Paymob-SYMPL",
    "Paymob-ApplePay",
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
 * Get payment provider name
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

  // Check for free delivery threshold (check both configs)
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
 * @param {number} totalPrice
 * @param {string} paymentMethod - Optional, for provider-specific validation
 * @returns {Promise<ValidationResult>}
 */
export const validateOrderAmount = async (totalPrice, paymentMethod = null) => {
  // Get relevant config based on payment method
  let config = null;

  if (paymentMethod && paymentMethod.startsWith("Paymob-")) {
    config = await PaymobConfig.findOne({ isActive: true });

    // Use PaymobConfig's built-in validation if available
    if (config) {
      const validation = await PaymobConfig.validateOrderAmount(
        totalPrice,
        paymentMethod
      );
      if (!validation.success) {
        return validation;
      }
    }
  } else {
    // Use StripeConfig for Stripe and general validation
    config = await StripeConfig.findOne({ isActive: true });
  }

  // Fallback to StripeConfig if no Paymob config
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
  const paymentProvider = getPaymentProvider(order.paymentMethod?.name || "");

  let config = null;

  if (paymentProvider === "paymob") {
    config = await PaymobConfig.findOne({ isActive: true });

    if (config) {
      return PaymobConfig.canRefundOrder(
        order.createdAt,
        refundAmount || order.totalPrice,
        order.totalPrice
      );
    }
  } else if (paymentProvider === "stripe") {
    config = await StripeConfig.findOne({ isActive: true });
  }

  if (!config) {
    return { success: true }; // No config = allow refund
  }

  // Check refund window
  if (config.refundWindowHours > 0) {
    const orderDate = new Date(order.createdAt);
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
  if (
    refundAmount &&
    refundAmount < order.totalPrice &&
    !config.allowPartialRefunds
  ) {
    return {
      success: false,
      message: "Partial refunds are not allowed",
      statusCode: 400,
    };
  }

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

export default {
  validatePaymentMethod,
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
};
