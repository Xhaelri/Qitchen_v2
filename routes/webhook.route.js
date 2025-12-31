// webhook.route.js
// ✅ Webhook routes - NO authentication (called by external payment providers)

import express from "express";

// Stripe webhook
import {
  webhook as stripeWebhook,
  webhookMiddleware as stripeWebhookMiddleware,
} from "../controllers/stripeWebhook.controller.js";

// Paymob webhook
import {
  paymobWebhookHealthCheck,
  handlePaymobWebhook,
  checkPaymentStatus,
  getOrderByUniquePaymentId,
} from "../controllers/paymobWebhook.controller.js";

const router = express.Router();

// ==================== STRIPE WEBHOOKS ====================

// POST /api/v2/webhooks/stripe - Stripe webhook callback
// Uses raw body parser for signature verification
router.post("/stripe", stripeWebhookMiddleware, stripeWebhook);

// ==================== PAYMOB WEBHOOKS ====================

// GET /api/v2/webhooks/paymob - Health check
router.get("/paymob", paymobWebhookHealthCheck);

// POST /api/v2/webhooks/paymob - Paymob callback endpoint
router.post("/paymob", handlePaymobWebhook);

// ==================== PAYMENT STATUS (for frontend redirect) ====================

// GET /api/v2/webhooks/payment/:uniquePaymentId - Get order by payment ID
router.get("/payment/:uniquePaymentId", getOrderByUniquePaymentId);

// GET /api/v2/webhooks/order/:orderId/status - Check payment status
router.get("/order/:orderId/status", checkPaymentStatus);

export { router };

/*
==================== ROUTE SUMMARY ====================

No authentication required (external service callbacks)

STRIPE:
POST   /api/v2/webhooks/stripe                          - Stripe webhook

PAYMOB:
GET    /api/v2/webhooks/paymob                          - Health check
POST   /api/v2/webhooks/paymob                          - Paymob webhook

PAYMENT STATUS (frontend redirect):
GET    /api/v2/webhooks/payment/:uniquePaymentId        - Get order by payment ID
GET    /api/v2/webhooks/order/:orderId/status           - Check payment status

==================== WEBHOOK SETUP ====================

STRIPE:
1. Stripe Dashboard > Developers > Webhooks
2. Add endpoint: https://your-domain.com/api/v2/webhooks/stripe
3. Events: checkout.session.completed, checkout.session.expired,
   payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
4. Copy signing secret to STRIPE_WEBHOOK_SECRET env var

PAYMOB:
1. Paymob Dashboard > Settings > Webhooks
2. Callback URL: https://your-domain.com/api/v2/webhooks/paymob
3. Copy HMAC secret to PAYMOB_HMAC_SECRET env var

*/
