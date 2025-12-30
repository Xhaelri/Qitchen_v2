import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import {
  validateInPlaceOrder,
} from "./reservation.helpers.js";
import {
  calculateDeliveryFee,
  validatePaymentMethod,
  validateOrderAmount,
  getPaymentMethodId,
} from "./payment.helpers.js";

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} success
 * @property {number} [statusCode]
 * @property {string} [message]
 * @property {*} [data]
 */

/**
 * Validate common order fields
 * @param {Object} params
 * @returns {ValidationResult}
 */
export const validateCommonOrderFields = async ({
  userId,
  placeType,
  tableId,
  paymentMethod,
  governorate,
  city,
}) => {
  // Check authentication
  if (!userId) {
    return {
      success: false,
      statusCode: 401,
      message: "User not authenticated",
    };
  }

  // Validate delivery location for online orders
  if (placeType === "Online" && (!governorate || !city)) {
    return {
      success: false,
      statusCode: 400,
      message: "Governorate and city are required for online orders",
    };
  }

  // Validate in-place orders require tableId
  if (placeType === "In-Place" && !tableId) {
    return {
      success: false,
      statusCode: 400,
      message: "Table ID is required for in-place orders",
    };
  }

  // Validate tableId is only for in-place orders
  if (placeType !== "In-Place" && tableId) {
    return {
      success: false,
      statusCode: 400,
      message: "tableId is only allowed for In-Place orders",
    };
  }

  // Validate payment method is active
  const paymentValidation = await validatePaymentMethod(paymentMethod);
  if (!paymentValidation.success) {
    return {
      success: false,
      statusCode: paymentValidation.statusCode,
      message: paymentValidation.message,
    };
  }

  // Validate in-place order (table availability)
  if (placeType === "In-Place") {
    const validation = await validateInPlaceOrder(tableId);
    if (!validation.success) {
      return {
        success: false,
        statusCode: validation.statusCode,
        message: validation.message,
      };
    }
  }

  return { success: true };
};

/**
 * Get payment method ID from name
 * @param {string} paymentMethod
 * @returns {Promise<ValidationResult>}
 */
export const getPaymentMethodIdSafe = async (paymentMethod) => {
  try {
    const paymentMethodId = await getPaymentMethodId(paymentMethod);
    return { success: true, data: paymentMethodId };
  } catch (error) {
    return {
      success: false,
      statusCode: 404,
      message: error.message,
    };
  }
};

/**
 * Calculate delivery fee safely
 * @param {Object} params
 * @returns {Promise<ValidationResult>}
 */
export const calculateDeliveryFeeSafe = async ({
  placeType,
  governorate,
  city,
  subtotal,
}) => {
  try {
    const deliveryFee = await calculateDeliveryFee(
      placeType,
      governorate,
      city,
      subtotal
    );
    return { success: true, data: deliveryFee };
  } catch (error) {
    return {
      success: false,
      statusCode: 400,
      message: error.message,
    };
  }
};

/**
 * Validate order amount
 * @param {number} totalPrice
 * @returns {Promise<ValidationResult>}
 */
export const validateOrderAmountSafe = async (totalPrice) => {
  const amountValidation = await validateOrderAmount(totalPrice);
  if (!amountValidation.success) {
    return {
      success: false,
      statusCode: amountValidation.statusCode,
      message: amountValidation.message,
    };
  }
  return { success: true };
};

/**
 * Validate and get cart with products
 * @param {string} cartId
 * @returns {Promise<ValidationResult>}
 */
export const validateAndGetCart = async (cartId) => {
  if (!cartId) {
    return {
      success: false,
      statusCode: 400,
      message: "Cart ID is required",
    };
  }

  const cart = await Cart.findById(cartId).populate("products.product");
  
  if (!cart) {
    return {
      success: false,
      statusCode: 404,
      message: "Cart not found",
    };
  }

  if (!cart.products.length) {
    return {
      success: false,
      statusCode: 400,
      message: "Cart is empty",
    };
  }

  return { success: true, data: cart };
};

/**
 * Validate and get single product
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<ValidationResult>}
 */
export const validateAndGetProduct = async (productId, quantity) => {
  if (!productId) {
    return {
      success: false,
      statusCode: 400,
      message: "Product ID is required",
    };
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      success: false,
      statusCode: 400,
      message: "Quantity must be a positive integer",
    };
  }

  const product = await Product.findById(productId);
  
  if (!product) {
    return {
      success: false,
      statusCode: 404,
      message: "Product not found",
    };
  }

  return { success: true, data: product };
};

/**
 * Validate and enrich multiple products
 * @param {Array} products - Array of { productId, quantity }
 * @returns {Promise<ValidationResult>}
 */
export const validateAndEnrichProducts = async (products) => {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return {
      success: false,
      statusCode: 400,
      message: "Products array is required",
    };
  }

  try {
    let subtotal = 0;
    let totalQuantity = 0;

    const enrichedProducts = await Promise.all(
      products.map(async (item) => {
        if (!item.productId || !item.quantity) {
          throw new Error("Each product must have productId and quantity");
        }

        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new Error("Quantity must be a positive integer");
        }

        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        subtotal += product.price * item.quantity;
        totalQuantity += item.quantity;

        return {
          product: product._id,
          productData: product, // Keep full product data for payment processing
          quantity: item.quantity,
        };
      })
    );

    return {
      success: true,
      data: {
        enrichedProducts,
        subtotal,
        totalQuantity,
      },
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 400,
      message: error.message,
    };
  }
};

/**
 * Full order validation pipeline
 * Validates all common fields and returns processed data
 * @param {Object} params
 * @returns {Promise<ValidationResult>}
 */
export const validateOrderRequest = async ({
  userId,
  addressId,
  placeType,
  tableId,
  paymentMethod,
  governorate,
  city,
}) => {
  // Validate address
  if (!addressId) {
    return {
      success: false,
      statusCode: 400,
      message: "Address ID is required",
    };
  }

  // Validate common fields
  const commonValidation = await validateCommonOrderFields({
    userId,
    placeType,
    tableId,
    paymentMethod,
    governorate,
    city,
  });

  if (!commonValidation.success) {
    return commonValidation;
  }

  // Get payment method ID
  const paymentMethodResult = await getPaymentMethodIdSafe(paymentMethod);
  if (!paymentMethodResult.success) {
    return paymentMethodResult;
  }

  return {
    success: true,
    data: {
      paymentMethodId: paymentMethodResult.data,
    },
  };
};

export default {
  validateCommonOrderFields,
  getPaymentMethodIdSafe,
  calculateDeliveryFeeSafe,
  validateOrderAmountSafe,
  validateAndGetCart,
  validateAndGetProduct,
  validateAndEnrichProducts,
  validateOrderRequest,
};
