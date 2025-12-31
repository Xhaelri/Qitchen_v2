// paymobConfig.route.js
// ✅ Paymob configuration routes - Admin only
// Provider-specific settings (NOT payment method activation)

import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

import {
  getPaymobConfig,
  updatePaymobConfig,
  updateIntegrationNames,
  resetPaymobConfig,
  getWebhookInfo,
} from "../controllers/paymobConfig.controller.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(jwtVerify);
router.use(checkAdminRole);

// ==================== CONFIG ROUTES ====================

// GET /api/v2/paymob-config - Get Paymob configuration
router.get("/", getPaymobConfig);

// PATCH /api/v2/paymob-config - Update Paymob configuration
router.patch("/", updatePaymobConfig);

// POST /api/v2/paymob-config/reset - Reset to defaults
router.post("/reset", resetPaymobConfig);

// ==================== INTEGRATION ROUTES ====================

// PUT /api/v2/paymob-config/integrations - Update integration names
router.put("/integrations", updateIntegrationNames);

// ==================== WEBHOOK INFO ====================

// GET /api/v2/paymob-config/webhooks - Get webhook info
router.get("/webhooks", getWebhookInfo);

export { router };

/*
==================== ROUTE SUMMARY ====================

All routes require: JWT + Admin Role

GET    /api/v2/paymob-config                - Get configuration
PATCH  /api/v2/paymob-config                - Update configuration
POST   /api/v2/paymob-config/reset          - Reset to defaults
PUT    /api/v2/paymob-config/integrations   - Update integration names
POST   /api/v2/paymob-config/sync           - Sync with Paymob dashboard
GET    /api/v2/paymob-config/webhooks       - Get webhook info

==================== CONFIGURABLE SETTINGS ====================

Order Limits:
- minOrderAmount, maxOrderAmount, currency

Refund Settings:
- refundWindowHours, allowPartialRefunds, autoRefundOnCancellation

Void Settings:
- allowVoidTransaction, autoVoidOnCancellation

Integration Names (from Paymob dashboard):
- cardIntegrationName, walletIntegrationName
- kioskIntegrationName, installmentsIntegrationName, valuIntegrationName

Payment Options:
- saveCardEnabled, require3DSecure
- kioskExpirationHours
- minInstallmentAmount, valuMinAmount

URLs:
- customRedirectUrl, customWebhookUrl

==================== IMPORTANT ====================

To enable/disable Paymob payment methods, use:
PATCH /api/v2/payment-methods/:id/toggle

These config routes are for PROVIDER SETTINGS only.

*/
