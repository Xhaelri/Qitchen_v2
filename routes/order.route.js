import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

import {
  // Unified order creation (handles ALL payment methods: Card, Paymob-Card, Paymob-Wallet, COD)
  createOrderFromCart,
  createOrderFromProduct,
  createOrderFromProducts,

  // Order retrieval
  getAllOrders,
  getAllOrdersForUser,
  getCurrentUserOrders,
  getOrderDetails,
  getOrdersByOrderStatus,

  // Order management
  updateOrderStatus,
  updateOrderPlaceType,

  // Refunds & Cancellation
  refundOrder,
  cancelOrder,
  retryPayment,
  getPaymentStatus,
} from "../controllers/order.controller.js";

const router = express.Router();

router.use(jwtVerify);

// ==================== ORDER RETRIEVAL ====================
router.get("/get-all-orders-for-current-user", getCurrentUserOrders);
router.get("/get-all-orders", checkAdminRole, getAllOrders);
router.get("/get-orders-by-status", checkAdminRole, getOrdersByOrderStatus);
router.get("/get-all-orders-for-user/:userId", getAllOrdersForUser);
router.get("/:orderId", getOrderDetails);
router.get("/payment-status:orderId", getPaymentStatus);

// ==================== ORDER CREATION ====================
// All endpoints now support: Card (Stripe), Paymob-Card, Paymob-Wallet, COD
// Just pass paymentMethod in request body

// Create order from cart (unified - replaces both old endpoints)
router.post("/create-order-cart/:cartId/:addressId", createOrderFromCart);

// Create order for single product
router.post( "/create-order-product/:productId/:addressId", createOrderFromProduct );

// Create order for multiple products
router.post( "/create-order-products-multiple/:addressId", createOrderFromProducts );

// ==================== ORDER MANAGEMENT ====================
router.patch( "/update-order-status/:orderId", checkAdminRole, updateOrderStatus );
router.patch("/place-type/:orderId", checkAdminRole, updateOrderPlaceType);

// ==================== RETRY PAYMENT ====================
router.post("/retry-payment/:orderId", checkAdminRole, retryPayment);

// ==================== REFUNDS & CANCELLATION ====================
router.post("/refund/:orderId", checkAdminRole, refundOrder);
router.post("/cancel/:orderId", checkAdminRole, cancelOrder);

export { router };
