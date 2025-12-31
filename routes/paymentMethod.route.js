// paymentMethod.route.js
// ✅ Payment method routes - Public + Admin endpoints
// PaymentMethod.isActive is the SINGLE SOURCE OF TRUTH for activation

import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

import {
  // Public
  getActivePaymentMethods,
  
  // Admin
  getAllPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethod,
  deletePaymentMethod,
} from "../controllers/paymentMethod.controller.js";

const router = express.Router();

// ==================== PUBLIC ROUTES (No Auth) ====================

// GET /api/v2/payment-methods - Active payment methods for checkout
router.get("/", getActivePaymentMethods);

// ==================== ADMIN ROUTES (JWT + Admin Role) ====================

// GET /api/v2/payment-methods/all - All payment methods (including inactive)
router.get("/all", jwtVerify, checkAdminRole, getAllPaymentMethods);

// POST /api/v2/payment-methods - Create payment method
router.post("/", jwtVerify, checkAdminRole, upload.array("image", 1), createPaymentMethod);

// PATCH /api/v2/payment-methods/:paymentMethodId - Update payment method
router.patch(
  "/:paymentMethodId",
  jwtVerify,
  checkAdminRole,
  upload.array("image", 1),
  updatePaymentMethod
);

// PATCH /api/v2/payment-methods/:paymentMethodId/toggle - Toggle active status
router.patch("/:paymentMethodId/toggle", jwtVerify, checkAdminRole, togglePaymentMethod);

// DELETE /api/v2/payment-methods/:paymentMethodId - Delete payment method
router.delete("/:paymentMethodId", jwtVerify, checkAdminRole, deletePaymentMethod);

export { router };

/*
==================== ROUTE SUMMARY ====================

PUBLIC (No Auth):
GET    /api/v2/payment-methods                          - Active methods for checkout

ADMIN (JWT + Admin Role):
GET    /api/v2/payment-methods/all                      - All methods (inc. inactive)
POST   /api/v2/payment-methods                          - Create method
PATCH  /api/v2/payment-methods/:id                      - Update method
PATCH  /api/v2/payment-methods/:id/toggle               - Toggle active
DELETE /api/v2/payment-methods/:id                      - Delete method

==================== IMPORTANT ====================

PaymentMethod.isActive is the SINGLE SOURCE OF TRUTH for enabling/disabling.

DO NOT use:
- StripeConfig.cardPaymentEnabled ❌
- PaymobConfig.walletPaymentEnabled ❌

These config files are for PROVIDER SETTINGS only, not activation.

*/
