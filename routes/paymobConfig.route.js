import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

import {
  getPaymobConfig,
  updatePaymobConfig,
  getEnabledPaymentMethods,
  togglePaymentMethod,
  updateIntegrationNames,
  syncWithPaymob,
  resetPaymobConfig,
} from "../controllers/paymobConfig.controllers.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(jwtVerify);
router.use(checkAdminRole);

// ==================== CONFIG ROUTES ====================

// Get current Paymob configuration
router.get("/", getPaymobConfig);

// Update Paymob configuration
router.put("/", updatePaymobConfig);

// Reset configuration to defaults
router.post("/reset", resetPaymobConfig);

// Sync with Paymob dashboard
router.post("/sync", syncWithPaymob);

// ==================== PAYMENT METHOD ROUTES ====================

// Get list of enabled payment methods
router.get("/payment-methods", getEnabledPaymentMethods);

// Toggle specific payment method on/off
router.patch("/payment-method/:method", togglePaymentMethod);

// Update integration names
router.put("/integrations", updateIntegrationNames);

export { router };

/*
==================== API DOCUMENTATION ====================

All endpoints require:
- Authentication (JWT token)
- Admin role

==================== ENDPOINTS ====================

1. GET /api/v2/admin/paymob-config
   Get current Paymob configuration
   Response: { success: true, data: PaymobConfig }

2. PUT /api/v2/admin/paymob-config
   Update Paymob configuration
   Body: { field1: value1, field2: value2, ... }
   Example:
   {
     "minOrderAmount": 50,
     "maxOrderAmount": 10000,
     "refundWindowHours": 48,
     "cardPaymentEnabled": true,
     "walletPaymentEnabled": true,
     "isLiveMode": false
   }

3. POST /api/v2/admin/paymob-config/reset
   Reset configuration to default values

4. POST /api/v2/admin/paymob-config/sync
   Sync configuration with Paymob dashboard

5. GET /api/v2/admin/paymob-config/payment-methods
   Get list of enabled payment methods
   Response: { success: true, data: ["Paymob-Card", "Paymob-Wallet"] }

6. PATCH /api/v2/admin/paymob-config/payment-method/:method
   Toggle specific payment method on/off
   Params: method = "Paymob-Card" | "Paymob-Wallet" | etc.
   Body: { enabled: true } // optional, toggles if not provided

7. PUT /api/v2/admin/paymob-config/integrations
   Update integration names from Paymob dashboard
   Body:
   {
     "cardIntegrationName": "my-card-integration",
     "walletIntegrationName": "my-wallet-integration"
   }

==================== AVAILABLE PAYMENT METHODS ====================

- Paymob-Card        (Visa, Mastercard, Meeza)
- Paymob-Wallet      (Vodafone Cash, Orange, Etisalat)
- Paymob-Kiosk       (Aman, Masary)
- Paymob-Installments (Bank installments)
- Paymob-ValU        (ValU BNPL)
- Paymob-Souhoola    (Souhoola BNPL)
- Paymob-SYMPL       (SYMPL BNPL)
- Paymob-ApplePay    (Apple Pay - requires activation)

==================== CONFIGURATION FIELDS ====================

Order Amount Settings:
- minOrderAmount: number (default: 0)
- maxOrderAmount: number (default: 50000)
- currency: "EGP" | "USD" | "SAR" | "AED" | "OMR" | "PKR"

Refund Settings:
- refundWindowHours: number (default: 72)
- allowPartialRefunds: boolean (default: true)
- autoRefundOnCancellation: boolean (default: false)

Void Settings:
- allowVoidTransaction: boolean (default: true)
- autoVoidOnCancellation: boolean (default: true)

Checkout Settings:
- checkoutType: "hosted" | "iframe" | "pixel"

Card Settings:
- cardPaymentEnabled: boolean
- cardIntegrationName: string
- saveCardEnabled: boolean
- require3DSecure: boolean

Wallet Settings:
- walletPaymentEnabled: boolean
- walletIntegrationName: string

... and more (see paymobConfig.model.js)

*/
