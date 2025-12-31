// stripeConfig.route.js
// ✅ Stripe configuration routes - Admin only
// Provider-specific settings (NOT payment method activation)

import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

import {
  getStripeConfig,
  updateStripeConfig,
  verifyStripeConnection,
  getStripeBalance,
  resetStripeConfig,
  getWebhookInfo,
} from "../controllers/stripeConfig.controller.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(jwtVerify);
router.use(checkAdminRole);

// ==================== CONFIG ROUTES ====================

// GET /api/v2/stripe-config - Get Stripe configuration
router.get("/", getStripeConfig);

// PATCH /api/v2/stripe-config - Update Stripe configuration
router.patch("/", updateStripeConfig);

// POST /api/v2/stripe-config/reset - Reset to defaults
router.post("/reset", resetStripeConfig);

// ==================== CONNECTION ROUTES ====================

// GET /api/v2/stripe-config/verify - Verify Stripe connection
router.get("/verify", verifyStripeConnection);

// GET /api/v2/stripe-config/balance - Get Stripe balance
router.get("/balance", getStripeBalance);

// GET /api/v2/stripe-config/webhooks - Get webhook info
router.get("/webhooks", getWebhookInfo);

export { router };

/*
==================== ROUTE SUMMARY ====================

All routes require: JWT + Admin Role

GET    /api/v2/stripe-config                - Get configuration
PATCH  /api/v2/stripe-config                - Update configuration
POST   /api/v2/stripe-config/reset          - Reset to defaults
GET    /api/v2/stripe-config/verify         - Verify connection
GET    /api/v2/stripe-config/balance        - Get balance
GET    /api/v2/stripe-config/webhooks       - Get webhook info

==================== CONFIGURABLE SETTINGS ====================

Order Limits:
- minOrderAmount, maxOrderAmount, currency

Refund Settings:
- refundWindowHours, allowPartialRefunds, autoRefundOnCancellation

Checkout Settings:
- checkoutMode, checkoutExpirationMinutes, allowPromotionCodes
- collectBillingAddress, collectShippingAddress, collectPhoneNumber

Stripe Features (sub-options within Stripe checkout):
- enableApplePay, enableGooglePay, enableLink
- allowedCardBrands

Security:
- require3DSecure, captureMethod, authorizationValidDays

==================== IMPORTANT ====================

To enable/disable the "Card" payment method itself, use:
PATCH /api/v2/payment-methods/:id/toggle

These config routes are for PROVIDER SETTINGS only.

*/
