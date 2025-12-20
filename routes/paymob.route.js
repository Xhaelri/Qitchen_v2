// routes/paymob.route.js
import express from "express";
import {
  paymobWebhookHealthCheck,
  handlePaymobWebhook,
  checkPaymentStatus,
  getOrderByUniquePaymentId,
} from "../controllers/paymobWebhook.controller.js";

const router = express.Router();

// ==================== WEBHOOK ROUTES ====================
// GET /paymob-webhook - Health check endpoint
router.get("/paymob-webhook", paymobWebhookHealthCheck);

// POST /paymob-webhook - Handle Paymob webhook callbacks
router.post("/paymob-webhook", handlePaymobWebhook);

// ==================== PAYMENT STATUS ROUTES ====================
// GET /order/:orderId/payment-status - Check payment status by order ID
router.get("/order/:orderId/payment-status", checkPaymentStatus);

// GET /payment/:uniquePaymentId - Get order details by unique payment ID
router.get("/payment/:uniquePaymentId", getOrderByUniquePaymentId);

export { router };