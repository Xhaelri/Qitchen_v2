// paymentStrategy.service.js
// ✅ Activation is checked in validatePaymentMethod() before reaching here
import Stripe from "stripe";
import Order from "../models/order.model.js";
import StripeConfig from "../models/stripeConfig.model.js";
import PaymobConfig from "../models/paymobConfig.model.js";
import PaymobService from "./paymob.service.js";
import StripeService from "./stripe.service.js";
import "dotenv/config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Payment Strategy Interface
 * All payment strategies must implement processPayment method
 */
class PaymentStrategy {
  async processPayment(order, context) {
    throw new Error("processPayment must be implemented by subclass");
  }

  async processRefund(order, amount, reason) {
    throw new Error("processRefund must be implemented by subclass");
  }

  async voidTransaction(order) {
    throw new Error("voidTransaction must be implemented by subclass");
  }

  getProviderName() {
    throw new Error("getProviderName must be implemented by subclass");
  }

  async getConfig() {
    throw new Error("getConfig must be implemented by subclass");
  }
}

/**
 * Stripe Payment Strategy
 */
class StripePaymentStrategy extends PaymentStrategy {
  constructor() {
    super();
  }

  getProviderName() {
    return "stripe";
  }

  async getConfig() {
    return StripeConfig.findOne({ isActive: true });
  }

  async processPayment(order, context) {
    const { products, deliveryFee, frontendUrl, userId, metadata = {} } = context;

    // ✅ No activation check needed - already done in validatePaymentMethod()
    // Just validate amount against provider limits
    const config = await this.getConfig();
    if (config) {
      const amountValidation = await StripeConfig.validateOrderAmount(order.totalPrice);
      if (!amountValidation.success) {
        return {
          success: false,
          provider: this.getProviderName(),
          redirectUrl: null,
          message: amountValidation.message,
        };
      }
    }

    // Use StripeService for checkout session creation
    const result = await StripeService.createCheckoutSession(order, {
      products,
      deliveryFee,
      userId,
      metadata,
      deliveryDescription: context.deliveryDescription,
      customerEmail: context.customerEmail,
    });

    return result;
  }

  async processRefund(order, amount, reason) {
    return StripeService.refundPayment(order, amount, reason);
  }

  async voidTransaction(order) {
    return StripeService.expireSession(order);
  }
}

/**
 * Paymob Payment Strategy (Card, Wallet, Kiosk, etc.)
 */
class PaymobPaymentStrategy extends PaymentStrategy {
  constructor(paymentType) {
    super();
    this.paymentType = paymentType;
  }

  getProviderName() {
    return "paymob";
  }

  async getConfig() {
    return PaymobConfig.findOne({ isActive: true });
  }

  async processPayment(order, context) {
    const { req, paymentMethod } = context;
    const config = await this.getConfig();

    // ✅ No activation check needed - already done in validatePaymentMethod()
    // Just validate amount against provider limits
    if (config) {
      const amountValidation = await PaymobConfig.validateOrderAmount(
        order.totalPrice,
        paymentMethod || this.paymentType
      );

      if (!amountValidation.success) {
        return {
          success: false,
          provider: this.getProviderName(),
          redirectUrl: null,
          message: amountValidation.message,
        };
      }
    }

    const result = await PaymobService.createPaymentForOrder(
      order,
      req,
      paymentMethod || this.paymentType
    );

    if (!result.success) {
      return {
        success: false,
        provider: this.getProviderName(),
        redirectUrl: null,
        message: result.message || "Failed to create Paymob payment",
      };
    }

    return {
      success: true,
      provider: this.getProviderName(),
      redirectUrl: result.checkoutUrl,
      transactionId: result.transactionId,
      message: "Paymob checkout session created. Redirect to payment.",
    };
  }

  async processRefund(order, amount, reason) {
    try {
      const config = await this.getConfig();

      // Validate refund using PaymobConfig
      if (config) {
        const canRefund = await PaymobConfig.canRefundOrder(
          order.createdAt,
          amount,
          order.totalPrice
        );

        if (!canRefund.success) {
          return canRefund;
        }
      }

      // Call Paymob refund API
      const result = await PaymobService.refundTransaction(
        order.paymobTransactionId || order.paymobData?.obj?.id,
        Math.round(amount * 100)
      );

      if (!result.success) {
        return {
          success: false,
          message: result.message || "Paymob refund failed",
        };
      }

      return {
        success: true,
        provider: this.getProviderName(),
        refundId: result.refundId,
        amount,
        status: result.status,
      };
    } catch (error) {
      console.error("Paymob refund error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async voidTransaction(order) {
    try {
      const config = await this.getConfig();

      if (config && !config.allowVoidTransaction) {
        return {
          success: false,
          message: "Void transactions are disabled",
        };
      }

      const transactionId = order.paymobTransactionId || order.paymobData?.obj?.id;

      if (!transactionId) {
        return {
          success: false,
          message: "No Paymob transaction found to void",
        };
      }

      const result = await PaymobService.voidTransaction(transactionId);

      if (!result.success) {
        return {
          success: false,
          message: result.message || "Paymob void failed",
        };
      }

      return {
        success: true,
        provider: this.getProviderName(),
        message: "Transaction voided successfully",
      };
    } catch (error) {
      console.error("Paymob void error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

/**
 * Cash on Delivery (COD) Strategy
 */
class CODPaymentStrategy extends PaymentStrategy {
  getProviderName() {
    return "cod";
  }

  async getConfig() {
    // COD uses StripeConfig for general order limits
    return StripeConfig.findOne({ isActive: true });
  }

  async processPayment(order, context) {
    // ✅ No activation check needed - already done in validatePaymentMethod()
    // COD doesn't require any external payment processing
    return {
      success: true,
      provider: this.getProviderName(),
      redirectUrl: null,
      message: "COD order created successfully",
    };
  }

  async processRefund(order, amount, reason) {
    // COD orders don't have actual refunds
    return {
      success: true,
      provider: this.getProviderName(),
      message: "COD order cancelled - no payment to refund",
    };
  }

  async voidTransaction(order) {
    return {
      success: true,
      provider: this.getProviderName(),
      message: "COD order cancelled",
    };
  }
}

/**
 * Payment Strategy Factory
 * Maps payment method names to their respective strategies
 */
const paymentStrategies = {
  Card: new StripePaymentStrategy(),
  "Paymob-Card": new PaymobPaymentStrategy("Paymob-Card"),
  "Paymob-Wallet": new PaymobPaymentStrategy("Paymob-Wallet"),
  "Paymob-Kiosk": new PaymobPaymentStrategy("Paymob-Kiosk"),
  "Paymob-Installments": new PaymobPaymentStrategy("Paymob-Installments"),
  "Paymob-ValU": new PaymobPaymentStrategy("Paymob-ValU"),
  COD: new CODPaymentStrategy(),
};

/**
 * Get the appropriate payment strategy for a payment method
 * @param {string} paymentMethod - The payment method name
 * @returns {PaymentStrategy}
 * @throws {Error} If payment method is not supported
 */
export const getPaymentStrategy = (paymentMethod) => {
  const strategy = paymentStrategies[paymentMethod];

  if (!strategy) {
    throw new Error(
      `Unsupported payment method: ${paymentMethod}. Supported methods: ${Object.keys(
        paymentStrategies
      ).join(", ")}`
    );
  }

  return strategy;
};

/**
 * Check if a payment method is supported
 * @param {string} paymentMethod
 * @returns {boolean}
 */
export const isPaymentMethodSupported = (paymentMethod) => {
  return paymentMethod in paymentStrategies;
};

/**
 * Get all supported payment methods
 * @returns {string[]}
 */
export const getSupportedPaymentMethods = () => {
  return Object.keys(paymentStrategies);
};

/**
 * Get payment provider for a payment method
 * @param {string} paymentMethod
 * @returns {string} - 'stripe', 'paymob', or 'cod'
 */
export const getPaymentProvider = (paymentMethod) => {
  if (paymentMethod === "Card") return "stripe";
  if (paymentMethod.startsWith("Paymob-")) return "paymob";
  if (paymentMethod === "COD") return "cod";
  return "unknown";
};

/**
 * Process payment using the appropriate strategy
 * ✅ NOTE: Activation should be validated BEFORE calling this function
 * @param {string} paymentMethod - The payment method name
 * @param {Object} order - The order document
 * @param {Object} context - Additional context
 * @returns {Promise<PaymentResult>}
 */
export const processPayment = async (paymentMethod, order, context) => {
  const strategy = getPaymentStrategy(paymentMethod);
  return strategy.processPayment(order, { ...context, paymentMethod });
};

/**
 * Process refund using the appropriate strategy
 * @param {string} paymentMethod - The payment method name
 * @param {Object} order - The order document
 * @param {number} amount - Amount to refund
 * @param {string} reason - Refund reason
 * @returns {Promise<RefundResult>}
 */
export const processRefund = async (paymentMethod, order, amount, reason) => {
  const strategy = getPaymentStrategy(paymentMethod);
  return strategy.processRefund(order, amount, reason);
};

/**
 * Void transaction using the appropriate strategy
 * @param {string} paymentMethod - The payment method name
 * @param {Object} order - The order document
 * @returns {Promise<VoidResult>}
 */
export const voidTransaction = async (paymentMethod, order) => {
  const strategy = getPaymentStrategy(paymentMethod);
  return strategy.voidTransaction(order);
};

export default {
  getPaymentStrategy,
  isPaymentMethodSupported,
  getSupportedPaymentMethods,
  getPaymentProvider,
  processPayment,
  processRefund,
  voidTransaction,
};