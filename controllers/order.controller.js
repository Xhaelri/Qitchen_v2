import Cart from "../models/cart.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Reservation from "../models/reservation.model.js";
import StripeConfig from "../models/stripConfig.model.js";
import Stripe from "stripe";
import "dotenv/config";
import {
  validateInPlaceOrder,
  createReservationForOrder,
  createReservationDate,
} from "../helpers/reservation.helpers.js";
import {
  calculateDeliveryFee,
  validatePaymentMethod,
  validateOrderAmount
} from "../helpers/payment.helpers.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const currency = "usd";

// ------------------ CREATE ORDER FROM CART ------------------
export const createOrderForCart = async (req, res) => {
  const FRONTEND_URL =
    process.env.FRONT_PRODUCTION_URL || process.env.CLIENT_URL;

  try {
    const userId = req.user?._id;
    const { cartId, addressId } = req.params;
    const {
      placeType = "Online",
      tableId,
      slot,
      date,
      paymentMethod = "Card",
      governorate,
      city,
    } = req.body;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });

    if (!cartId || !addressId)
      return res.status(400).json({
        success: false,
        message: "Cart ID and Address ID are required",
      });

    // Validate delivery location for online orders
    if (placeType === "Online" && (!governorate || !city)) {
      return res.status(400).json({
        success: false,
        message: "Governorate and city are required for online orders",
      });
    }

    if (placeType === "In-Place" && !tableId)
      return res.status(400).json({
        success: false,
        message: "Table ID is required for in-place orders",
      });

    if (placeType === "In-Place" && (!date || !slot))
      return res.status(400).json({
        success: false,
        message: "Date and time slot are required for in-place orders",
      });

    if (placeType !== "In-Place" && tableId) {
      return res.status(400).json({
        success: false,
        message: "tableId is only allowed for In-Place orders",
      });
    }

    const paymentValidation = await validatePaymentMethod(paymentMethod);
    if (!paymentValidation.success) {
      return res.status(paymentValidation.statusCode).json({
        success: false,
        message: paymentValidation.message,
      });
    }
    // ✅ Validate in-place order using helper
    let reservationDate;
    if (placeType === "In-Place") {
      const validation = await validateInPlaceOrder(tableId, slot, date);
      if (!validation.success) {
        return res.status(validation.statusCode).json({
          success: false,
          message: validation.message,
        });
      }
      reservationDate = validation.reservationDate;
    }

    const cart = await Cart.findById(cartId).populate("products.product");
    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    if (!cart.products.length)
      return res.status(400).json({ success: false, message: "Cart is empty" });

    // Calculate delivery fee
    const subtotal = cart.totalPrice;
    let deliveryFee = 0;

    try {
      deliveryFee = await calculateDeliveryFee(
        placeType,
        governorate,
        city,
        subtotal
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const totalPrice = subtotal + deliveryFee;

    // Validate order amount
    const amountValidation = await validateOrderAmount(totalPrice);
    if (!amountValidation.success) {
      return res.status(amountValidation.statusCode).json({
        success: false,
        message: amountValidation.message,
      });
    }

    // Create Order
    const order = await Order.create({
      buyer: userId,
      products: cart.products.map((item) => ({
        product: item.product._id,
        quantity: item.quantity,
      })),
      subtotal,
      deliveryFee,
      totalPrice,
      totalQuantity: cart.totalQuantity,
      paymentStatus: "Pending",
      paymentMethod,
      orderStatus: "Processing",
      address: addressId,
      placeType,
      table: tableId || null,
      deliveryLocation:
        placeType === "Online" ? { governorate, city } : undefined,
    });

    // ✅ Create reservation for in-place orders
    if (placeType === "In-Place") {
      await createReservationForOrder(
        userId,
        tableId,
        reservationDate,
        order._id
      );
    }

    if (paymentMethod === "Card") {
      // Stripe line items
      const line_items = cart.products.map((item) => ({
        price_data: {
          currency,
          product_data: {
            name: item.product.name,
            images: item.product.images || [],
          },
          unit_amount: Math.round(item.product.price * 100),
        },
        quantity: item.quantity,
      }));

       // Add delivery fee as separate line item
      if (deliveryFee > 0) {
        line_items.push({
          price_data: {
            currency,
            product_data: {
              name: "Delivery Fee",
              description: `Delivery to ${city}, ${governorate}`,
            },
            unit_amount: Math.round(deliveryFee * 100),
          },
          quantity: 1,
        });
      }

      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items,
        mode: "payment",
        success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
        cancel_url: `${FRONTEND_URL}/payment/cancelled?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
        metadata: {
          orderId: order._id.toString(),
          userId: userId.toString(),
          cartId: cartId.toString(),
        },
      });

      await Order.findByIdAndUpdate(order._id, { stripeSessionID: session.id });

      const populatedOrder = await Order.findById(order._id)
        .populate("products.product")
        .populate("address")
        .populate("table");

      return res.status(201).json({
        success: true,
        session_url: session.url,
        orderId: order._id,
        order: populatedOrder,
        message: "Stripe session created. Redirect to payment.",
      });
    } else {
      // COD: no Stripe
      const populatedOrder = await Order.findById(order._id)
        .populate("products.product")
        .populate("address")
        .populate("table");

      return res.status(201).json({
        success: true,
        order: populatedOrder,
        message: "COD order created successfully",
      });
    }
  } catch (error) {
    console.error("Error in createOrderForCart:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ==================== CREATE ORDER FOR SINGLE PRODUCT ====================
export const createOrderForProduct = async (req, res) => {
  const FRONTEND_URL =
    process.env.FRONT_PRODUCTION_URL || process.env.CLIENT_URL;

  try {
    const userId = req.user?._id;
    const { productId, addressId } = req.params;
    const {
      placeType = "Online",
      tableId,
      slot,
      date,
      quantity = 1,
      paymentMethod = "Card",
      governorate,
      city,
    } = req.body;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });

    if (!productId || !addressId)
      return res.status(400).json({
        success: false,
        message: "Product ID and Address ID are required",
      });

    // Validate delivery location for online orders
    if (placeType === "Online" && (!governorate || !city)) {
      return res.status(400).json({
        success: false,
        message: "Governorate and city are required for online orders",
      });
    }

    if (placeType === "In-Place" && !tableId)
      return res.status(400).json({
        success: false,
        message: "Table ID is required for in-place orders",
      });

    if (placeType === "In-Place" && (!date || !slot))
      return res.status(400).json({
        success: false,
        message: "Date and time slot are required for in-place orders",
      });

    if (placeType !== "In-Place" && (tableId || date || slot)) {
      return res.status(400).json({
        success: false,
        message: "tableId, date, and slot are only allowed for In-Place orders",
      });
    }

    const paymentValidation = await validatePaymentMethod(paymentMethod);
    if (!paymentValidation.success) {
      return res.status(paymentValidation.statusCode).json({
        success: false,
        message: paymentValidation.message,
      });
    }

    // Validate in-place order
    let reservationDate;
    if (placeType === "In-Place") {
      const validation = await validateInPlaceOrder(tableId, slot, date);
      if (!validation.success) {
        return res.status(validation.statusCode).json({
          success: false,
          message: validation.message,
        });
      }
      reservationDate = validation.reservationDate;
    }

    if (!Number.isInteger(quantity) || quantity < 1)
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });

    const product = await Product.findById(productId);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    // Calculate delivery fee
    const subtotal = product.price * quantity;
    let deliveryFee = 0;
    
    try {
      deliveryFee = await calculateDeliveryFee(placeType, governorate, city, subtotal);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const totalPrice = subtotal + deliveryFee;

    // Validate order amount
    const amountValidation = await validateOrderAmount(totalPrice);
    if (!amountValidation.success) {
      return res.status(amountValidation.statusCode).json({
        success: false,
        message: amountValidation.message,
      });
    }

    const order = await Order.create({
      buyer: userId,
      products: [{ product: productId, quantity }],
      subtotal,
      deliveryFee,
      totalPrice,
      totalQuantity: quantity,
      paymentStatus: "Pending",
      paymentMethod,
      orderStatus: "Processing",
      address: addressId,
      placeType,
      table: tableId || null,
      deliveryLocation: placeType === "Online" ? { governorate, city } : undefined,
    });

    // Create reservation for in-place orders
    if (placeType === "In-Place") {
      await createReservationForOrder(
        userId,
        tableId,
        reservationDate,
        order._id
      );
    }

    if (paymentMethod === "Card") {
      const line_items = [
        {
          price_data: {
            currency,
            product_data: { name: product.name, images: product.images || [] },
            unit_amount: Math.round(product.price * 100),
          },
          quantity,
        },
      ];

      // Add delivery fee as separate line item
      if (deliveryFee > 0) {
        line_items.push({
          price_data: {
            currency,
            product_data: {
              name: "Delivery Fee",
              description: `Delivery to ${city}, ${governorate}`,
            },
            unit_amount: Math.round(deliveryFee * 100),
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items,
        mode: "payment",
        success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
        cancel_url: `${FRONTEND_URL}/payment/cancelled?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
        metadata: {
          orderId: order._id.toString(),
          userId: userId.toString(),
          productId,
        },
      });

      await Order.findByIdAndUpdate(order._id, { stripeSessionID: session.id });

      const populatedOrder = await Order.findById(order._id)
        .populate("products.product")
        .populate("address")
        .populate("table");

      return res.status(201).json({
        success: true,
        session_url: session.url,
        orderId: order._id,
        order: populatedOrder,
        message: "Stripe session created. Redirect to payment.",
      });
    } else {
      const populatedOrder = await Order.findById(order._id)
        .populate("products.product")
        .populate("address")
        .populate("table");

      return res.status(201).json({
        success: true,
        order: populatedOrder,
        message: "COD order created successfully",
      });
    }
  } catch (error) {
    console.error("Error in createOrderForProduct:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CREATE ORDER FOR MULTIPLE PRODUCTS ====================
export const createOrderForMultipleProducts = async (req, res) => {
  const FRONTEND_URL =
    process.env.FRONT_PRODUCTION_URL || process.env.CLIENT_URL;

  try {
    const userId = req.user?._id;
    const { addressId } = req.params;
    const {
      products,
      placeType = "Online",
      tableId,
      slot,
      date,
      paymentMethod = "Card",
      governorate,
      city,
    } = req.body;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });

    if (!products || !Array.isArray(products) || products.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "Products array is required" });

    // Validate delivery location for online orders
    if (placeType === "Online" && (!governorate || !city)) {
      return res.status(400).json({
        success: false,
        message: "Governorate and city are required for online orders",
      });
    }

    if (placeType !== "In-Place" && (tableId || date || slot)) {
      return res.status(400).json({
        success: false,
        message: "tableId, date, and slot are only allowed for In-Place orders",
      });
    }

    if (!addressId)
      return res
        .status(400)
        .json({ success: false, message: "Address ID is required" });

    if (placeType === "In-Place" && !tableId)
      return res.status(400).json({
        success: false,
        message: "Table ID is required for in-place orders",
      });

    if (placeType === "In-Place" && (!date || !slot))
      return res.status(400).json({
        success: false,
        message: "Date and time slot are required for in-place orders",
      });

    // Validate payment method is active
    const paymentValidation = await validatePaymentMethod(paymentMethod);
    if (!paymentValidation.success) {
      return res.status(paymentValidation.statusCode).json({
        success: false,
        message: paymentValidation.message,
      });
    }

    // Validate in-place order
    let reservationDate;
    if (placeType === "In-Place") {
      const validation = await validateInPlaceOrder(tableId, slot, date);
      if (!validation.success) {
        return res.status(validation.statusCode).json({
          success: false,
          message: validation.message,
        });
      }
      reservationDate = validation.reservationDate;
    }

    let subtotal = 0;
    let totalQuantity = 0;

    const enrichedProducts = await Promise.all(
      products.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        subtotal += product.price * item.quantity;
        totalQuantity += item.quantity;
        return { product: product._id, quantity: item.quantity };
      })
    );

    // Calculate delivery fee
    let deliveryFee = 0;
    
    try {
      deliveryFee = await calculateDeliveryFee(placeType, governorate, city, subtotal);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const totalPrice = subtotal + deliveryFee;

    // Validate order amount
    const amountValidation = await validateOrderAmount(totalPrice);
    if (!amountValidation.success) {
      return res.status(amountValidation.statusCode).json({
        success: false,
        message: amountValidation.message,
      });
    }

    const order = await Order.create({
      buyer: userId,
      products: enrichedProducts,
      subtotal,
      deliveryFee,
      totalPrice,
      totalQuantity,
      paymentStatus: "Pending",
      paymentMethod,
      orderStatus: "Processing",
      address: addressId,
      placeType,
      table: tableId || null,
      deliveryLocation: placeType === "Online" ? { governorate, city } : undefined,
    });

    // Create reservation for in-place orders
    if (placeType === "In-Place") {
      await createReservationForOrder(
        userId,
        tableId,
        reservationDate,
        order._id
      );
    }

    if (paymentMethod === "Card") {
      const line_items = await Promise.all(
        enrichedProducts.map(async (item) => {
          const product = await Product.findById(item.product);
          return {
            price_data: {
              currency,
              product_data: {
                name: product.name,
                images: product.images || [],
              },
              unit_amount: Math.round(product.price * 100),
            },
            quantity: item.quantity,
          };
        })
      );

      // Add delivery fee as separate line item
      if (deliveryFee > 0) {
        line_items.push({
          price_data: {
            currency,
            product_data: {
              name: "Delivery Fee",
              description: `Delivery to ${city}, ${governorate}`,
            },
            unit_amount: Math.round(deliveryFee * 100),
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items,
        mode: "payment",
        success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
        cancel_url: `${FRONTEND_URL}/payment/cancelled?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
        metadata: { orderId: order._id.toString(), userId: userId.toString() },
      });

      await Order.findByIdAndUpdate(order._id, { stripeSessionID: session.id });

      const populatedOrder = await Order.findById(order._id)
        .populate("products.product")
        .populate("address")
        .populate("table");

      return res.status(201).json({
        success: true,
        session_url: session.url,
        orderId: order._id,
        order: populatedOrder,
        message: "Stripe session created. Redirect to payment.",
      });
    } else {
      const populatedOrder = await Order.findById(order._id)
        .populate("products.product")
        .populate("address")
        .populate("table");

      return res.status(201).json({
        success: true,
        order: populatedOrder,
        message: "COD order created successfully",
      });
    }
  } catch (error) {
    console.error("Error in createOrderForMultipleProducts:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET ORDER DETAILS ====================
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("products.product")
      .populate("address")
      .populate("buyer", "-refreshToken -password -__v")
      .populate("table");

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    return res
      .status(200)
      .json({ success: true, order, message: "Order fetched successfully" });
  } catch (error) {
    console.error("Error in getOrderDetails:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET ALL ORDERS FOR USER ====================
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
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const totalOrders = await Order.countDocuments({ buyer: userId });

    if (!orders.length)
      return res
        .status(404)
        .json({ success: false, message: "No orders found" });

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

// ==================== GET CURRENT USER ORDERS ====================
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
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const totalOrders = await Order.countDocuments({ buyer: userId });

    if (!orders.length)
      return res
        .status(404)
        .json({ success: false, message: "No orders found" });

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

// ==================== GET ALL ORDERS (ADMIN) ====================
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, orderStatus } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const filter = {};
    if (orderStatus) filter.orderStatus = orderStatus;

    const orders = await Order.find(filter)
      .populate("products.product")
      .populate("address")
      .populate("buyer", "-password -__v -refreshToken")
      .populate("table")
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
      message: orderStatus
        ? `Orders with status '${orderStatus}' fetched successfully`
        : "Orders fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllOrders:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== UPDATE ORDER STATUS ====================
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId)
      return res
        .status(400)
        .json({ success: false, message: "Order id is required" });

    const allowedFields = ["orderStatus"];
    const changes = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) changes[field] = req.body[field];
    });

    if (!Object.keys(changes).length)
      return res
        .status(400)
        .json({ success: false, message: "orderStatus field is required" });

    const updatedOrderStatus = await Order.findByIdAndUpdate(orderId, changes, {
      new: true,
    });

    return res.status(200).json({
      data: updatedOrderStatus,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ------------------ GET ORDERS BY STATUS ------------------
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

    // Normalize orderStatus into array
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
    ];

    const invalidStatuses = statuses.filter(
      (status) => !validOrderStatuses.includes(status)
    );

    if (invalidStatuses.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid statuses: ${invalidStatuses.join(", ")}. 
                  Valid statuses are: ${validOrderStatuses.join(", ")}`,
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

// ------------------ UPDATE ORDER PLACE TYPE ------------------
export const updateOrderPlaceType = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { placeType, tableId, date, slot } = req.body;

    if (!orderId)
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required" });

    const validPlaceTypes = ["Online", "In-Place", "Takeaway"];
    if (!placeType || !validPlaceTypes.includes(placeType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid placeType. Valid types: ${validPlaceTypes.join(
          ", "
        )}`,
      });
    }

    const order = await Order.findById(orderId);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    // If changing FROM In-Place to something else, delete the associated reservation
    if (
      order.placeType === "In-Place" &&
      placeType !== "In-Place" &&
      order.table
    ) {
      await Reservation.findOneAndDelete({
        orderId: orderId,
        table: order.table,
      });
    }

    if (placeType === "In-Place") {
      if (!tableId || !date || !slot)
        return res.status(400).json({
          success: false,
          message:
            "tableId, date, and slot are required when changing placeType to In-Place",
        });

      // ✅ Validate in-place order using helper
      const validation = await validateInPlaceOrder(tableId, slot, date);
      if (!validation.success) {
        return res.status(validation.statusCode).json({
          success: false,
          message: validation.message,
        });
      }

      // ✅ Create new reservation for the order
      await createReservationForOrder(
        order.buyer,
        tableId,
        validation.reservationDate,
        orderId
      );
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
      .populate("buyer", "-password -__v -refreshToken");

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

// ==================== REFUND ORDER ====================
export const refundOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { refundAmount, refundReason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentStatus !== "Completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed payments can be refunded",
      });
    }

    if (order.paymentMethod !== "Card") {
      return res.status(400).json({
        success: false,
        message: "Refunds are only available for card payments",
      });
    }

    // Get Stripe config
    const config = await StripeConfig.findOne({ isActive: true });
    
    // Check refund window
    if (config && config.refundWindowHours > 0) {
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      const hoursSinceOrder = (now - orderDate) / (1000 * 60 * 60);
      
      if (hoursSinceOrder > config.refundWindowHours) {
        return res.status(400).json({
          success: false,
          message: `Refund window of ${config.refundWindowHours} hours has expired`,
        });
      }
    }

    // Validate refund amount
    let amountToRefund = order.totalPrice;
    
    if (refundAmount) {
      if (!config || !config.allowPartialRefunds) {
        return res.status(400).json({
          success: false,
          message: "Partial refunds are not allowed",
        });
      }
      
      if (refundAmount <= 0 || refundAmount > order.totalPrice) {
        return res.status(400).json({
          success: false,
          message: "Invalid refund amount",
        });
      }
      
      amountToRefund = refundAmount;
    }

    // Get payment intent from session
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionID);
    const paymentIntentId = session.payment_intent;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Payment intent not found for this order",
      });
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amountToRefund * 100),
      reason: refundReason || "requested_by_customer",
    });

    // Update order
    const isPartialRefund = amountToRefund < order.totalPrice;
    
    order.paymentStatus = isPartialRefund ? "PartiallyRefunded" : "Refunded";
    order.orderStatus = "Cancelled";
    order.refundDetails = {
      refundId: refund.id,
      refundAmount: amountToRefund,
      refundDate: new Date(),
      refundReason: refundReason || "Customer requested refund",
      refundStatus: refund.status === "succeeded" ? "Completed" : "Pending",
    };
    
    await order.save();

    return res.status(200).json({
      success: true,
      data: {
        order,
        refund: {
          id: refund.id,
          amount: amountToRefund,
          status: refund.status,
        },
      },
      message: `${isPartialRefund ? "Partial refund" : "Full refund"} processed successfully`,
    });
  } catch (error) {
    console.error("Error in refundOrder:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== CANCEL ORDER WITH AUTO REFUND ====================
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    const config = await StripeConfig.findOne({ isActive: true });
    let refundMessage = "";

    // Handle Card payments
    if (order.paymentMethod === "Card" && order.stripeSessionID) {
      
      // Case 1: Payment is completed - issue refund
      if (order.paymentStatus === "Completed") {
        if (config?.autoRefundOnCancellation) {
          try {
            const session = await stripe.checkout.sessions.retrieve(order.stripeSessionID);
            const paymentIntentId = session.payment_intent;

            if (paymentIntentId) {
              const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reason: "requested_by_customer",
              });

              order.refundDetails = {
                refundId: refund.id,
                refundAmount: order.totalPrice,
                refundDate: new Date(),
                refundReason: cancellationReason || "Order cancelled",
                refundStatus: refund.status === "succeeded" ? "Completed" : "Pending",
              };
              
              order.paymentStatus = "Refunded";
              refundMessage = " and refund initiated";
            }
          } catch (refundError) {
            console.error("Auto-refund failed:", refundError);
            refundMessage = " (refund failed - please process manually)";
          }
        }
      } 
      // Case 2: Payment is pending - expire the Stripe session
      else if (order.paymentStatus === "Pending") {
        try {
          // Expire the checkout session to prevent future payment
          await stripe.checkout.sessions.expire(order.stripeSessionID);
          order.paymentStatus = "Failed";
          refundMessage = " and payment session cancelled";
        } catch (expireError) {
          console.error("Failed to expire Stripe session:", expireError);
          // Continue with cancellation even if session expiry fails
        }
      }
    }
    // COD orders - just cancel (no refund needed)
    else if (order.paymentMethod === "COD") {
      refundMessage = " (no payment to refund for COD)";
    }

    // Delete reservation if it's an In-Place order
    if (order.placeType === "In-Place" && order.table) {
      await Reservation.findOneAndDelete({
        orderId: orderId,
        table: order.table,
      });
    }

    order.orderStatus = "Cancelled";
    order.cancellationReason = cancellationReason || "Cancelled by user";
    await order.save();

    return res.status(200).json({
      success: true,
      data: order,
      message: `Order cancelled successfully${refundMessage}`,
    });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};