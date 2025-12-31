// order.route.js
// ✅ Order routes - Customer + Admin endpoints

import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

import {
  // Order creation (Customer)
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

  // Payment operations
  refundOrder,
  cancelOrder,
  retryPayment,
  getPaymentStatus,
  capturePayment,
  updatePaymentStatusForCOD,
} from "../controllers/order.controller.js";

const router = express.Router();

// All order routes require authentication
router.use(jwtVerify);



// ==================== ADMIN ROUTES (JWT + Admin Role) ====================

// Order Retrieval (all orders)
// GET /api/v2/orders/all
router.get("/all", checkAdminRole, getAllOrders);

// GET /api/v2/orders/user/:userId
router.get("/user/:userId", checkAdminRole, getAllOrdersForUser);

// GET /api/v2/orders/status/:status
router.get("/status/:status", checkAdminRole, getOrdersByOrderStatus);

// Order Management

// PATCH /api/v2/orders/payment-status/:orderId
router.patch("/payment-status/:orderId", checkAdminRole, updatePaymentStatusForCOD); // ✅ ADD THIS

// PATCH /api/v2/orders/:orderId/status
router.patch("/status/:orderId", checkAdminRole, updateOrderStatus);

// PATCH /api/v2/orders/:orderId/place-type
router.patch("/:orderId/place-type", checkAdminRole, updateOrderPlaceType);

// Payment Operations
// POST /api/v2/orders/:orderId/refund
router.post("/refund/:orderId", checkAdminRole, refundOrder);

// POST /api/v2/orders/:orderId/cancel
router.post("/:orderId/cancel", checkAdminRole, cancelOrder);

// POST /api/v2/orders/:orderId/retry-payment
router.post("/:orderId/retry-payment", checkAdminRole, retryPayment);

// POST /api/v2/orders/:orderId/capture
router.post("/:orderId/capture", checkAdminRole, capturePayment);



// ==================== CUSTOMER ROUTES (JWT only) ====================

// Order Creation
// POST /api/v2/orders/cart/:cartId/:addressId
router.post("/cart/:cartId/:addressId", createOrderFromCart);

// POST /api/v2/orders/product/:productId/:addressId
router.post("/product/:productId/:addressId", createOrderFromProduct);

// POST /api/v2/orders/products/:addressId
router.post("/products/:addressId", createOrderFromProducts);

// Order Retrieval (own orders)
// GET /api/v2/orders/my-orders
router.get("/my-orders", getCurrentUserOrders);

// GET /api/v2/orders/:orderId
router.get("/:orderId", getOrderDetails);

// GET /api/v2/orders/:orderId/payment-status (✅ FIXED typo)
router.get("/:orderId/payment-status", getPaymentStatus);


export { router };

/*
==================== ROUTE SUMMARY ====================

CUSTOMER (JWT only):
POST   /api/v2/orders/cart/:cartId/:addressId           - Create from cart
POST   /api/v2/orders/product/:productId/:addressId     - Create single product
POST   /api/v2/orders/products/:addressId               - Create multiple products
GET    /api/v2/orders/my-orders                         - Current user's orders
GET    /api/v2/orders/:orderId                          - Order details
GET    /api/v2/orders/:orderId/payment-status           - Payment status

ADMIN (JWT + Admin Role):
GET    /api/v2/orders/all                               - All orders
GET    /api/v2/orders/user/:userId                      - Orders for user
GET    /api/v2/orders/status/:status                    - Orders by status
PATCH  /api/v2/orders/:orderId/status                   - Update order status
PATCH  /api/v2/orders/:orderId/place-type               - Update place type
POST   /api/v2/orders/:orderId/refund                   - Process refund
POST   /api/v2/orders/:orderId/cancel                   - Cancel order
POST   /api/v2/orders/:orderId/retry-payment            - Retry payment
POST   /api/v2/orders/:orderId/capture                  - Capture payment

==================== ORDER CREATION BODY ====================

{
  "placeType": "Online" | "In-Place" | "Takeaway",
  "tableId": "ObjectId",           // Required if placeType is "In-Place"
  "paymentMethod": "Card" | "Paymob-Card" | "Paymob-Wallet" | "COD",
  "governorate": "string",         // Required for Online orders
  "city": "string"                 // Required for Online orders
}

For /products/:addressId:
{
  "products": [
    { "productId": "ObjectId", "quantity": 1 }
  ]
}

*/
