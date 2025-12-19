import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

import {
  createOrderForCart,
  createOrderForProduct,
  createOrderForMultipleProducts,
  getAllOrders,
  getAllOrdersForUser,
  getCurrentUserOrders,
  getOrderDetails,
  getOrdersByOrderStatus,
  updateOrderStatus,
  updateOrderPlaceType,
  refundOrder,
  cancelOrder,
} from "../controllers/order.controller.js";

const router = express.Router();

router.use(jwtVerify);

router.get("/get-all-orders-for-current-user", getCurrentUserOrders);
router.get("/get-all-orders", checkAdminRole, getAllOrders);
router.get("/get-orders-by-status", checkAdminRole, getOrdersByOrderStatus);
router.get("/get-all-orders-for-user/:userId", getAllOrdersForUser);
router.get("/:orderId", getOrderDetails);

router.post("/create-order-cart/:cartId/:addressId", createOrderForCart);

router.post( "/create-order-product/:productId/:addressId", createOrderForProduct );

router.post( "/create-order-products-multiple/:addressId", createOrderForMultipleProducts );

router.patch( "/update-order-status/:orderId", checkAdminRole, updateOrderStatus );

router.patch("/place-type/:orderId", checkAdminRole, updateOrderPlaceType);

router.post("/refund/:orderId", checkAdminRole , refundOrder);

router.post("/cancel/:orderId", checkAdminRole , cancelOrder);


export { router };
