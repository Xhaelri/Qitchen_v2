import Order from "../models/order.model.js";
import StripeConfig from "../models/stripeConfig.model.js";
import PaymobConfig from "../models/paymobConfig.model.js";
import "dotenv/config";

import { validateInPlaceOrder } from "../helpers/reservation.helpers.js";

import {
  validateOrderRequest,
  validateAndGetCart,
  validateAndGetProduct,
  validateAndEnrichProducts,
  calculateDeliveryFeeSafe,
} from "../helpers/orderValidation.helpers.js";

import {
  validateOrderAmount,
  validateRefundRequest,
  getPaymentProvider,
} from "../helpers/payment.helpers.js";

import {
  processPayment,
  processRefund,
} from "../services/paymentStrategy.service.js";

import StripeService from "../services/stripe.service.js";
import PaymobService from "../services/paymob.service.js";

// ==================== HELPER FUNCTIONS ====================

/**
 * Get frontend URL from environment
 */
const getFrontendUrl = () =>
  process.env.FRONT_PRODUCTION_URL || process.env.CLIENT_URL;

/**
 * Populate order with related data
 */
const populateOrder = async (orderId) => {
  return Order.findById(orderId)
    .populate("products.product")
    .populate("address")
    .populate("table")
    .populate("paymentMethod");
};

/**
 * Build order data object
 */
const buildOrderData = ({
  userId,
  products,
  subtotal,
  deliveryFee,
  totalPrice,
  totalQuantity,
  paymentMethodId,
  addressId,
  placeType,
  tableId,
  governorate,
  city,
}) => ({
  buyer: userId,
  products,
  subtotal,
  deliveryFee,
  totalPrice,
  totalQuantity,
  paymentStatus: "Pending",
  paymentMethod: paymentMethodId,
  orderStatus: "Processing",
  address: addressId,
  placeType,
  table: tableId || null,
  deliveryLocation:
    placeType === "Online" ? { governorate, city } : undefined,
});

/**
 * Build payment context for strategy
 */
const buildPaymentContext = ({
  products,
  deliveryFee,
  userId,
  req,
  governorate,
  city,
  customerEmail,
  metadata = {},
}) => ({
  products,
  deliveryFee,
  frontendUrl: getFrontendUrl(),
  userId,
  req,
  customerEmail,
  deliveryDescription:
    governorate && city ? `Delivery to ${city}, ${governorate}` : undefined,
  metadata,
});

/**
 * Format successful order response
 */
const formatOrderResponse = (order, paymentResult) => {
  const response = {
    success: true,
    orderId: order._id,
    order,
    provider: paymentResult.provider,
    message: paymentResult.message,
  };

  // Add redirect URL based on provider
  if (paymentResult.redirectUrl) {
    if (paymentResult.provider === "stripe") {
      response.session_url = paymentResult.redirectUrl;
    } else if (paymentResult.provider === "paymob") {
      response.paymentUrl = paymentResult.redirectUrl;
    }
    response.redirectUrl = paymentResult.redirectUrl;
  }

  return response;
};

/**
 * Validate order amount against provider-specific config
 * @param {number} totalPrice
 * @param {string} paymentMethod
 * @returns {Promise<{success: boolean, statusCode?: number, message?: string}>}
 */
const validateOrderAmountWithConfig = async (totalPrice, paymentMethod) => {
  const amountValidation = await validateOrderAmount(totalPrice, paymentMethod);
  if (!amountValidation.success) {
    return {
      success: false,
      statusCode: amountValidation.statusCode || 400,
      message: amountValidation.message,
    };
  }
  return { success: true };
};

/**
 * Get the appropriate config for the payment method
 * @param {string} paymentMethod
 * @returns {Promise<Object|null>}
 */
const getConfigForPaymentMethod = async (paymentMethod) => {
  if (paymentMethod === "Card") {
    return StripeConfig.findOne({ isActive: true });
  }
  if (paymentMethod.startsWith("Paymob-")) {
    return PaymobConfig.findOne({ isActive: true });
  }
  // COD and others use StripeConfig for general settings
  return StripeConfig.findOne({ isActive: true });
};

// ==================== UNIFIED ORDER CREATION ====================

/**
 * Create order from cart (supports all payment methods)
 * POST /orders/cart/:cartId/:addressId
 * 
 * @body {string} placeType - "Online" | "In-Place" | "Takeaway"
 * @body {string} tableId - Required if placeType is "In-Place"
 * @body {string} paymentMethod - "Card" | "Paymob-Card" | "Paymob-Wallet" | "COD" | etc.
 * @body {string} governorate - Required for "Online" orders
 * @body {string} city - Required for "Online" orders
 */
export const createOrderFromCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { cartId, addressId } = req.params;
    const {
      placeType = "Online",
      tableId,
      paymentMethod = "Card",
      governorate,
      city,
    } = req.body;

    // Validate request
    const validation = await validateOrderRequest({
      userId,
      addressId,
      placeType,
      tableId,
      paymentMethod,
      governorate,
      city,
    });

    if (!validation.success) {
      return res.status(validation.statusCode).json({
        success: false,
        message: validation.message,
      });
    }

    // Validate and get cart
    const cartResult = await validateAndGetCart(cartId);
    if (!cartResult.success) {
      return res.status(cartResult.statusCode).json({
        success: false,
        message: cartResult.message,
      });
    }

    const cart = cartResult.data;
    const subtotal = cart.totalPrice;

    // Calculate delivery fee
    const deliveryResult = await calculateDeliveryFeeSafe({
      placeType,
      governorate,
      city,
      subtotal,
    });

    if (!deliveryResult.success) {
      return res.status(deliveryResult.statusCode).json({
        success: false,
        message: deliveryResult.message,
      });
    }

    const deliveryFee = deliveryResult.data;
    const totalPrice = subtotal + deliveryFee;

    // Validate order amount against provider-specific config
    const amountResult = await validateOrderAmountWithConfig(totalPrice, paymentMethod);
    if (!amountResult.success) {
      return res.status(amountResult.statusCode).json({
        success: false,
        message: amountResult.message,
      });
    }

    // Create order
    const order = await Order.create(
      buildOrderData({
        userId,
        products: cart.products.map((item) => ({
          product: item.product._id,
          quantity: item.quantity,
        })),
        subtotal,
        deliveryFee,
        totalPrice,
        totalQuantity: cart.totalQuantity,
        paymentMethodId: validation.data.paymentMethodId,
        addressId,
        placeType,
        tableId,
        governorate,
        city,
      })
    );

    // Build products array for payment processing
    const productsForPayment = cart.products.map((item) => ({
      product: item.product,
      quantity: item.quantity,
    }));

    // Get customer email for receipts
    const customerEmail = req.user?.email;

    // Process payment using strategy
    const paymentResult = await processPayment(
      paymentMethod,
      order,
      buildPaymentContext({
        products: productsForPayment,
        deliveryFee,
        userId,
        req,
        governorate,
        city,
        customerEmail,
        metadata: { cartId, source: "cart" },
      })
    );

    if (!paymentResult.success) {
      // Mark order as failed if payment processing fails
      order.paymentStatus = "Failed";
      order.orderStatus = "Failed";
      await order.save();

      return res.status(500).json({
        success: false,
        message: paymentResult.message,
      });
    }

    // Get populated order
    const populatedOrder = await populateOrder(order._id);

    return res.status(201).json(formatOrderResponse(populatedOrder, paymentResult));
  } catch (error) {
    console.error("Error in createOrderFromCart:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create order for single product (supports all payment methods)
 * POST /orders/product/:productId/:addressId
 */
export const createOrderFromProduct = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId, addressId } = req.params;
    const {
      placeType = "Online",
      tableId,
      quantity = 1,
      paymentMethod = "Card",
      governorate,
      city,
    } = req.body;

    // Validate request
    const validation = await validateOrderRequest({
      userId,
      addressId,
      placeType,
      tableId,
      paymentMethod,
      governorate,
      city,
    });

    if (!validation.success) {
      return res.status(validation.statusCode).json({
        success: false,
        message: validation.message,
      });
    }

    // Validate and get product
    const productResult = await validateAndGetProduct(productId, quantity);
    if (!productResult.success) {
      return res.status(productResult.statusCode).json({
        success: false,
        message: productResult.message,
      });
    }

    const product = productResult.data;
    const subtotal = product.price * quantity;

    // Calculate delivery fee
    const deliveryResult = await calculateDeliveryFeeSafe({
      placeType,
      governorate,
      city,
      subtotal,
    });

    if (!deliveryResult.success) {
      return res.status(deliveryResult.statusCode).json({
        success: false,
        message: deliveryResult.message,
      });
    }

    const deliveryFee = deliveryResult.data;
    const totalPrice = subtotal + deliveryFee;

    // Validate order amount against provider-specific config
    const amountResult = await validateOrderAmountWithConfig(totalPrice, paymentMethod);
    if (!amountResult.success) {
      return res.status(amountResult.statusCode).json({
        success: false,
        message: amountResult.message,
      });
    }

    // Create order
    const order = await Order.create(
      buildOrderData({
        userId,
        products: [{ product: productId, quantity }],
        subtotal,
        deliveryFee,
        totalPrice,
        totalQuantity: quantity,
        paymentMethodId: validation.data.paymentMethodId,
        addressId,
        placeType,
        tableId,
        governorate,
        city,
      })
    );

    // Build products array for payment processing
    const productsForPayment = [{ product, quantity }];

    // Get customer email for receipts
    const customerEmail = req.user?.email;

    // Process payment using strategy
    const paymentResult = await processPayment(
      paymentMethod,
      order,
      buildPaymentContext({
        products: productsForPayment,
        deliveryFee,
        userId,
        req,
        governorate,
        city,
        customerEmail,
        metadata: { productId, source: "single-product" },
      })
    );

    if (!paymentResult.success) {
      // Mark order as failed if payment processing fails
      order.paymentStatus = "Failed";
      order.orderStatus = "Failed";
      await order.save();

      return res.status(500).json({
        success: false,
        message: paymentResult.message,
      });
    }

    // Get populated order
    const populatedOrder = await populateOrder(order._id);

    return res.status(201).json(formatOrderResponse(populatedOrder, paymentResult));
  } catch (error) {
    console.error("Error in createOrderFromProduct:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create order for multiple products (supports all payment methods)
 * POST /orders/products/:addressId
 */
export const createOrderFromProducts = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { addressId } = req.params;
    const {
      products,
      placeType = "Online",
      tableId,
      paymentMethod = "Card",
      governorate,
      city,
    } = req.body;

    // Validate request
    const validation = await validateOrderRequest({
      userId,
      addressId,
      placeType,
      tableId,
      paymentMethod,
      governorate,
      city,
    });

    if (!validation.success) {
      return res.status(validation.statusCode).json({
        success: false,
        message: validation.message,
      });
    }

    // Validate and enrich products
    const productsResult = await validateAndEnrichProducts(products);
    if (!productsResult.success) {
      return res.status(productsResult.statusCode).json({
        success: false,
        message: productsResult.message,
      });
    }

    const { enrichedProducts, subtotal, totalQuantity } = productsResult.data;

    // Calculate delivery fee
    const deliveryResult = await calculateDeliveryFeeSafe({
      placeType,
      governorate,
      city,
      subtotal,
    });

    if (!deliveryResult.success) {
      return res.status(deliveryResult.statusCode).json({
        success: false,
        message: deliveryResult.message,
      });
    }

    const deliveryFee = deliveryResult.data;
    const totalPrice = subtotal + deliveryFee;

    // Validate order amount against provider-specific config
    const amountResult = await validateOrderAmountWithConfig(totalPrice, paymentMethod);
    if (!amountResult.success) {
      return res.status(amountResult.statusCode).json({
        success: false,
        message: amountResult.message,
      });
    }

    // Create order
    const order = await Order.create(
      buildOrderData({
        userId,
        products: enrichedProducts.map((item) => ({
          product: item.product,
          quantity: item.quantity,
        })),
        subtotal,
        deliveryFee,
        totalPrice,
        totalQuantity,
        paymentMethodId: validation.data.paymentMethodId,
        addressId,
        placeType,
        tableId,
        governorate,
        city,
      })
    );

    // Build products array for payment processing (with full product data)
    const productsForPayment = enrichedProducts.map((item) => ({
      product: item.productData,
      quantity: item.quantity,
    }));

    // Get customer email for receipts
    const customerEmail = req.user?.email;

    // Process payment using strategy
    const paymentResult = await processPayment(
      paymentMethod,
      order,
      buildPaymentContext({
        products: productsForPayment,
        deliveryFee,
        userId,
        req,
        governorate,
        city,
        customerEmail,
        metadata: { source: "multiple-products" },
      })
    );

    if (!paymentResult.success) {
      // Mark order as failed if payment processing fails
      order.paymentStatus = "Failed";
      order.orderStatus = "Failed";
      await order.save();

      return res.status(500).json({
        success: false,
        message: paymentResult.message,
      });
    }

    // Get populated order
    const populatedOrder = await populateOrder(order._id);

    return res.status(201).json(formatOrderResponse(populatedOrder, paymentResult));
  } catch (error) {
    console.error("Error in createOrderFromProducts:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ORDER RETRIEVAL ====================

export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("products.product")
      .populate("address")
      .populate("buyer", "-refreshToken -password -__v")
      .populate("table")
      .populate("paymentMethod");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({
      success: true,
      order,
      message: "Order fetched successfully",
    });
  } catch (error) {
    console.error("Error in getOrderDetails:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllOrdersForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const orders = await Order.find({ buyer: userId })
      .populate("products.product")
      .populate("address")
      .populate("table")
      .populate("paymentMethod")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const totalOrders = await Order.countDocuments({ buyer: userId });

    if (!orders.length) {
      return res.status(404).json({ success: false, message: "No orders found" });
    }

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limitNum),
        totalOrders,
        hasNextPage: skip + orders.length < totalOrders,
        hasPrevPage: parseInt(page) > 1,
      },
      message: "Orders fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllOrdersForUser:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCurrentUserOrders = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const orders = await Order.find({ buyer: userId })
      .populate("products.product")
      .populate("address")
      .populate("table")
      .populate("paymentMethod")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const totalOrders = await Order.countDocuments({ buyer: userId });

    if (!orders.length) {
      return res.status(404).json({ success: false, message: "No orders found" });
    }

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limitNum),
        totalOrders,
        hasNextPage: skip + orders.length < totalOrders,
        hasPrevPage: parseInt(page) > 1,
      },
      message: "Orders fetched successfully",
    });
  } catch (error) {
    console.error("Error in getCurrentUserOrders:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, orderStatus, paymentStatus } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const filter = {};
    if (orderStatus) filter.orderStatus = orderStatus;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const orders = await Order.find(filter)
      .populate("products.product")
      .populate("address")
      .populate("buyer", "-password -__v -refreshToken")
      .populate("table")
      .populate("paymentMethod")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const totalOrders = await Order.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limitNum),
        totalOrders,
        hasNextPage: skip + orders.length < totalOrders,
        hasPrevPage: parseInt(page) > 1,
      },
      message: "Orders fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllOrders:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ORDER STATUS MANAGEMENT ====================

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order id is required" });
    }

    const allowedFields = ["orderStatus"];
    const changes = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) changes[field] = req.body[field];
    });

    if (!Object.keys(changes).length) {
      return res.status(400).json({ success: false, message: "orderStatus field is required" });
    }

    const updatedOrderStatus = await Order.findByIdAndUpdate(orderId, changes, {
      new: true,
    });

    return res.status(200).json({
      success: true,
      data: updatedOrderStatus,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrdersByOrderStatus = async (req, res) => {
  try {
    const { page = 1, limit = 10, orderStatus } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive numbers",
      });
    }

    if (!orderStatus) {
      return res.status(400).json({
        success: false,
        message: "At least 1 order status required!",
      });
    }

    const statuses =
      typeof orderStatus === "string"
        ? orderStatus.includes(",")
          ? orderStatus.split(",").map((s) => s.trim())
          : [orderStatus.trim()]
        : Array.isArray(orderStatus)
        ? orderStatus
        : [];

    const validOrderStatuses = [
      "Processing",
      "Paid",
      "Ready",
      "On the way",
      "Received",
      "Failed",
      "Cancelled",
    ];

    const invalidStatuses = statuses.filter(
      (status) => !validOrderStatuses.includes(status)
    );

    if (invalidStatuses.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid statuses: ${invalidStatuses.join(", ")}. Valid statuses are: ${validOrderStatuses.join(", ")}`,
      });
    }

    const skip = (pageNum - 1) * limitNum;
    const totalOrders = await Order.countDocuments({
      orderStatus: { $in: statuses },
    });

    const statusesData = await Promise.all(
      statuses.map(async (status) => {
        const orders = await Order.find({ orderStatus: status })
          .populate("products.product")
          .populate("address")
          .populate("buyer", "-password -__v -refreshToken")
          .populate("table")
          .populate("paymentMethod")
          .skip(skip)
          .limit(limitNum)
          .sort({ createdAt: -1 });

        return { status, orders };
      })
    );

    return res.status(200).json({
      success: true,
      data: statusesData,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalOrders / limitNum),
        totalOrders,
        hasNextPage: pageNum * limitNum < totalOrders,
        hasPrevPage: pageNum > 1,
      },
      message: "Orders fetched successfully by status",
    });
  } catch (error) {
    console.error("Error in getOrdersByOrderStatus:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOrderPlaceType = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { placeType, tableId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const validPlaceTypes = ["Online", "In-Place", "Takeaway"];
    if (!placeType || !validPlaceTypes.includes(placeType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid placeType. Valid types: ${validPlaceTypes.join(", ")}`,
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (placeType === "In-Place") {
      if (!tableId) {
        return res.status(400).json({
          success: false,
          message: "tableId is required when changing placeType to In-Place",
        });
      }

      const validation = await validateInPlaceOrder(tableId);
      if (!validation.success) {
        return res.status(validation.statusCode).json({
          success: false,
          message: validation.message,
        });
      }
      order.table = tableId;
    } else {
      order.table = null;
    }

    order.placeType = placeType;
    await order.save();

    const populatedOrder = await Order.findById(orderId)
      .populate("products.product")
      .populate("address")
      .populate("table")
      .populate("buyer", "-password -__v -refreshToken")
      .populate("paymentMethod");

    return res.status(200).json({
      success: true,
      order: populatedOrder,
      message: "Order placeType updated successfully",
    });
  } catch (error) {
    console.error("Error in updateOrderPlaceType:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REFUNDS & CANCELLATION ====================

/**
 * Refund an order (supports all payment methods)
 * POST /orders/:orderId/refund
 * 
 * @body {number} refundAmount - Amount to refund (optional, defaults to full amount)
 * @body {string} refundReason - Reason for refund
 */
export const refundOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { refundAmount, refundReason } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    // Get order with payment method populated
    const order = await Order.findById(orderId).populate("paymentMethod");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Validate payment status
    if (order.paymentStatus !== "Completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed payments can be refunded",
      });
    }

    // Get payment method name
    const paymentMethodName = order.paymentMethod?.name;
    if (!paymentMethodName) {
      return res.status(400).json({
        success: false,
        message: "Payment method not found for this order",
      });
    }

    // Validate refund amount
    const amountToRefund = refundAmount || order.totalPrice;
    if (refundAmount) {
      if (refundAmount <= 0 || refundAmount > order.totalPrice) {
        return res.status(400).json({
          success: false,
          message: `Invalid refund amount. Must be between 0 and ${order.totalPrice}`,
        });
      }
    }

    // Validate refund request against config
    const refundValidation = await validateRefundRequest(order, amountToRefund);
    if (!refundValidation.success) {
      return res.status(refundValidation.statusCode || 400).json({
        success: false,
        message: refundValidation.message,
      });
    }

    // Process refund using strategy
    const refundResult = await processRefund(
      paymentMethodName,
      order,
      amountToRefund,
      refundReason || "requested_by_customer"
    );

    if (!refundResult.success) {
      return res.status(400).json({
        success: false,
        message: refundResult.message,
      });
    }

    // Update order status
    const isPartialRefund = amountToRefund < order.totalPrice;
    order.paymentStatus = isPartialRefund ? "PartiallyRefunded" : "Refunded";
    
    order.refundDetails = {
      refundId: refundResult.refundId,
      refundAmount: amountToRefund,
      refundDate: new Date(),
      refundReason: refundReason || "Customer requested refund",
      refundStatus: refundResult.status === "succeeded" || refundResult.status === "completed" 
        ? "Completed" 
        : "Pending",
    };

    await order.save();

    return res.status(200).json({
      success: true,
      data: {
        order,
        refund: {
          id: refundResult.refundId,
          amount: amountToRefund,
          status: refundResult.status,
          provider: refundResult.provider,
        },
      },
      message: refundResult.message || `${isPartialRefund ? "Partial refund" : "Full refund"} processed successfully`,
    });
  } catch (error) {
    console.error("Error in refundOrder:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancel an order (supports all payment methods with auto-refund based on config)
 * POST /orders/:orderId/cancel
 * 
 * @body {string} cancellationReason - Reason for cancellation
 */
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    // Get order with payment method populated
    const order = await Order.findById(orderId).populate("paymentMethod");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check if already cancelled
    if (order.orderStatus === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    const paymentMethodName = order.paymentMethod?.name;
    const provider = getPaymentProvider(paymentMethodName || "");
    let refundMessage = "";
    let refundResult = null;

    // Handle cancellation based on payment provider and status
    if (provider === "stripe" && order.stripeSessionID) {
      refundResult = await StripeService.handleOrderCancellation(order);
      
      if (refundResult.success) {
        if (order.paymentStatus === "Completed" && refundResult.refundId) {
          order.paymentStatus = "Refunded";
          order.refundDetails = {
            refundId: refundResult.refundId,
            refundAmount: refundResult.amount || order.totalPrice,
            refundDate: new Date(),
            refundReason: cancellationReason || "Order cancelled",
            refundStatus: "Completed",
          };
          refundMessage = " and refund initiated";
        } else if (order.paymentStatus === "Pending") {
          order.paymentStatus = "Cancelled";
          refundMessage = " and payment session cancelled";
        }
      } else {
        refundMessage = ` (${refundResult.message})`;
      }
    } else if (provider === "paymob" && (order.paymobPaymentId || order.paymobIntentionId || order.paymobTransactionId)) {
      refundResult = await PaymobService.handleOrderCancellation(order);
      
      if (refundResult.success) {
        if (order.paymentStatus === "Completed" && refundResult.refundId) {
          order.paymentStatus = "Refunded";
          order.refundDetails = {
            refundId: refundResult.refundId,
            refundAmount: refundResult.amount || order.totalPrice,
            refundDate: new Date(),
            refundReason: cancellationReason || "Order cancelled",
            refundStatus: "Completed",
          };
          refundMessage = " and refund initiated";
        } else if (order.paymentStatus === "Pending") {
          order.paymentStatus = "Cancelled";
          refundMessage = " and payment voided";
        }
      } else {
        refundMessage = ` (${refundResult.message})`;
      }
    } else if (provider === "cod") {
      order.paymentStatus = "Cancelled";
      refundMessage = " (no payment to refund for COD)";
    } else {
      // Unknown or no payment method
      if (order.paymentStatus === "Pending") {
        order.paymentStatus = "Cancelled";
      }
      refundMessage = "";
    }

    // Update order status
    order.orderStatus = "Cancelled";
    order.cancellationReason = cancellationReason || "Cancelled by user";
    await order.save();

    // Reload with all populated fields
    const updatedOrder = await Order.findById(orderId)
      .populate("products.product")
      .populate("address")
      .populate("table")
      .populate("buyer", "-password -__v -refreshToken")
      .populate("paymentMethod");

    return res.status(200).json({
      success: true,
      data: updatedOrder,
      message: `Order cancelled successfully${refundMessage}`,
    });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PAYMENT STATUS CHECK ====================

/**
 * Check payment status for an order
 * GET /orders/:orderId/payment-status
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const order = await Order.findById(orderId).populate("paymentMethod");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const paymentMethodName = order.paymentMethod?.name;
    const provider = getPaymentProvider(paymentMethodName || "");

    let paymentDetails = {
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      provider,
      paymentMethod: paymentMethodName,
      totalPrice: order.totalPrice,
      currency: provider === "paymob" ? "EGP" : "USD",
    };

    // Get provider-specific details
    if (provider === "stripe" && order.stripeSessionID) {
      const stripeDetails = await StripeService.getPaymentDetails(order.stripeSessionID);
      if (stripeDetails.success) {
        paymentDetails.providerDetails = stripeDetails.data;
      }
    } else if (provider === "paymob") {
      paymentDetails.uniquePaymentId = order.uniquePaymentId;
      paymentDetails.providerDetails = {
        intentionId: order.paymobIntentionId,
        paymentId: order.paymobPaymentId,
        transactionId: order.paymobTransactionId,
      };
      
      // Get transaction details if we have a transaction ID
      if (order.paymobTransactionId) {
        const paymobDetails = await PaymobService.getTransaction(order.paymobTransactionId);
        if (paymobDetails.success) {
          paymentDetails.providerDetails.transaction = paymobDetails.data;
        }
      }
    }

    // Add refund details if available
    if (order.refundDetails?.refundId) {
      paymentDetails.refundDetails = order.refundDetails;
    }

    return res.status(200).json({
      success: true,
      data: paymentDetails,
      message: "Payment status fetched successfully",
    });
  } catch (error) {
    console.error("Error in getPaymentStatus:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CAPTURE PAYMENT (for manual capture) ====================

/**
 * Capture a previously authorized payment
 * POST /orders/:orderId/capture
 * 
 * @body {number} amount - Amount to capture (optional, defaults to full amount)
 */
export const capturePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const order = await Order.findById(orderId).populate("paymentMethod");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const paymentMethodName = order.paymentMethod?.name;
    const provider = getPaymentProvider(paymentMethodName || "");

    let captureResult;

    if (provider === "stripe") {
      // Check if config allows manual capture
      const config = await StripeConfig.findOne({ isActive: true });
      if (!config || config.captureMethod !== "manual") {
        return res.status(400).json({
          success: false,
          message: "Manual capture is not enabled in Stripe configuration",
        });
      }

      captureResult = await StripeService.capturePayment(order, amount);
    } else if (provider === "paymob") {
      // Paymob capture
      const transactionId = order.paymobTransactionId || order.paymobData?.obj?.id;
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: "No Paymob transaction found to capture",
        });
      }

      const amountCents = amount ? Math.round(amount * 100) : Math.round(order.totalPrice * 100);
      captureResult = await PaymobService.captureTransaction(transactionId, amountCents);
    } else {
      return res.status(400).json({
        success: false,
        message: "Capture is only supported for Stripe and Paymob payments",
      });
    }

    if (!captureResult.success) {
      return res.status(400).json({
        success: false,
        message: captureResult.message,
      });
    }

    // Update order status
    order.paymentStatus = "Completed";
    order.orderStatus = "Paid";
    await order.save();

    return res.status(200).json({
      success: true,
      data: {
        order,
        capture: captureResult,
      },
      message: "Payment captured successfully",
    });
  } catch (error) {
    console.error("Error in capturePayment:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== RETRY PAYMENT ====================

/**
 * Retry payment for a failed order
 * POST /orders/:orderId/retry-payment
 */
export const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const order = await Order.findById(orderId)
      .populate("paymentMethod")
      .populate("products.product");
      
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Only allow retry for failed or cancelled payments
    if (!["Failed", "Cancelled"].includes(order.paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Payment retry is only allowed for failed or cancelled orders",
      });
    }

    // Use provided payment method or existing one
    const methodToUse = paymentMethod || order.paymentMethod?.name;
    if (!methodToUse) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    // Validate order amount
    const amountResult = await validateOrderAmountWithConfig(order.totalPrice, methodToUse);
    if (!amountResult.success) {
      return res.status(amountResult.statusCode).json({
        success: false,
        message: amountResult.message,
      });
    }

    // Reset order status
    order.paymentStatus = "Pending";
    order.orderStatus = "Processing";
    await order.save();

    // Build products for payment
    const productsForPayment = order.products.map((item) => ({
      product: item.product,
      quantity: item.quantity,
    }));

    // Process payment
    const paymentResult = await processPayment(
      methodToUse,
      order,
      buildPaymentContext({
        products: productsForPayment,
        deliveryFee: order.deliveryFee,
        userId: order.buyer,
        req,
        governorate: order.deliveryLocation?.governorate,
        city: order.deliveryLocation?.city,
        metadata: { retryAttempt: true, originalOrderId: orderId },
      })
    );

    if (!paymentResult.success) {
      order.paymentStatus = "Failed";
      order.orderStatus = "Failed";
      await order.save();

      return res.status(500).json({
        success: false,
        message: paymentResult.message,
      });
    }

    const populatedOrder = await populateOrder(order._id);

    return res.status(200).json(formatOrderResponse(populatedOrder, paymentResult));
  } catch (error) {
    console.error("Error in retryPayment:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


export default {
  // Order creation
  createOrderFromCart,
  createOrderFromProduct,
  createOrderFromProducts,
  
  // Order retrieval
  getOrderDetails,
  getAllOrdersForUser,
  getCurrentUserOrders,
  getAllOrders,
  
  // Order status management
  updateOrderStatus,
  getOrdersByOrderStatus,
  updateOrderPlaceType,
  
  // Refunds & Cancellation
  refundOrder,
  cancelOrder,
  
  // Payment operations
  getPaymentStatus,
  capturePayment,
  retryPayment,
  
};
