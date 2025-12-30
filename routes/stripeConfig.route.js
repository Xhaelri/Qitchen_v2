import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

import {
  getStripeConfig,
  updateStripeConfig,
  getEnabledPaymentMethods,
  togglePaymentMethod,
  updateRefundSettings,
  updateCheckoutSettings,
  updateSecuritySettings,
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

// Get current Stripe configuration
router.get("/", getStripeConfig);

// Update Stripe configuration
router.put("/", updateStripeConfig);

// Reset configuration to defaults
router.post("/reset", resetStripeConfig);

// ==================== CONNECTION ROUTES ====================

// Verify Stripe API connection
router.get("/verify", verifyStripeConnection);

// Get Stripe account balance
router.get("/balance", getStripeBalance);

// Get webhook configuration info
router.get("/webhooks", getWebhookInfo);

// ==================== PAYMENT METHOD ROUTES ====================

// Get list of enabled payment methods
router.get("/payment-methods", getEnabledPaymentMethods);

// Toggle specific payment method on/off
router.patch("/payment-method/:method", togglePaymentMethod);

// ==================== SETTINGS ROUTES ====================

// Update refund settings
router.put("/refund-settings", updateRefundSettings);

// Update checkout settings
router.put("/checkout-settings", updateCheckoutSettings);

// Update security settings (3DS, capture)
router.put("/security-settings", updateSecuritySettings);

export { router };

/*
==================== API DOCUMENTATION ====================

All endpoints require:
- Authentication (JWT token)
- Admin role

==================== ENDPOINTS ====================

1. GET /api/v2/admin/stripe-config
   Get current Stripe configuration with summary
   Response: { success: true, data: StripeConfig, summary: {...} }

2. PUT /api/v2/admin/stripe-config
   Update Stripe configuration
   Body: { field1: value1, field2: value2, ... }
   Example:
   {
     "minOrderAmount": 5,
     "maxOrderAmount": 5000,
     "currency": "usd",
     "refundWindowHours": 48,
     "cardPaymentEnabled": true,
     "applePayEnabled": true,
     "googlePayEnabled": true
   }

3. POST /api/v2/admin/stripe-config/reset
   Reset configuration to default values

4. GET /api/v2/admin/stripe-config/verify
   Verify Stripe API connection and get account info
   Response: { connected: true, accountId, chargesEnabled, ... }

5. GET /api/v2/admin/stripe-config/balance
   Get Stripe account balance
   Response: { available: [...], pending: [...] }

6. GET /api/v2/admin/stripe-config/webhooks
   Get webhook configuration and recommended events

7. GET /api/v2/admin/stripe-config/payment-methods
   Get list of enabled payment methods
   Response: { data: ["Card", "Apple Pay"], apiTypes: ["card"] }

8. PATCH /api/v2/admin/stripe-config/payment-method/:method
   Toggle specific payment method on/off
   Methods: card, apple_pay, google_pay, link, bank_transfer, 
            ach_debit, sepa_debit, ideal, klarna, afterpay
   Body: { enabled: true }

9. PUT /api/v2/admin/stripe-config/refund-settings
   Update refund settings
   Body:
   {
     "refundWindowHours": 72,
     "allowPartialRefunds": true,
     "autoRefundOnCancellation": false
   }

10. PUT /api/v2/admin/stripe-config/checkout-settings
    Update checkout settings
    Body:
    {
      "checkoutExpirationMinutes": 30,
      "allowPromotionCodes": true,
      "collectBillingAddress": true,
      "collectPhoneNumber": false
    }

11. PUT /api/v2/admin/stripe-config/security-settings
    Update security settings
    Body:
    {
      "require3DSecure": true,
      "captureMethod": "automatic",
      "authorizationValidDays": 7
    }

==================== AVAILABLE PAYMENT METHODS ====================

- card           (Visa, Mastercard, Amex, Discover)
- apple_pay      (Apple Pay)
- google_pay     (Google Pay)
- link           (Stripe Link - fast checkout)
- bank_transfer  (Bank transfers)
- ach_debit      (ACH Direct Debit - US)
- sepa_debit     (SEPA Direct Debit - EU)
- ideal          (iDEAL - Netherlands)
- klarna         (Klarna BNPL)
- afterpay       (Afterpay/Clearpay BNPL)

==================== CONFIGURATION FIELDS ====================

Order Amount Settings:
- minOrderAmount: number (default: 0)
- maxOrderAmount: number (default: 10000)
- currency: string (default: "usd")

Refund Settings:
- refundWindowHours: number (default: 24, 0 = no limit)
- allowPartialRefunds: boolean (default: true)
- autoRefundOnCancellation: boolean (default: false)

Checkout Settings:
- checkoutMode: "payment" | "subscription" | "setup"
- useStripeCheckout: boolean (default: true)
- checkoutExpirationMinutes: number (1-1440, default: 30)
- allowPromotionCodes: boolean (default: false)
- collectBillingAddress: boolean (default: false)
- collectShippingAddress: boolean (default: false)
- collectPhoneNumber: boolean (default: false)

Customer Settings:
- allowGuestCheckout: boolean (default: true)
- createCustomerOnCheckout: boolean (default: false)
- saveCardForFutureUse: boolean (default: false)
- setupFutureUsage: null | "on_session" | "off_session"

Security Settings:
- require3DSecure: boolean (default: false)
- radar3DSRequestType: "automatic" | "any" | "challenge"
- captureMethod: "automatic" | "manual" (default: "automatic")
- authorizationValidDays: number (1-7, default: 7)

Statement Descriptor:
- statementDescriptor: string (max 22 chars)
- statementDescriptorSuffix: string (max 22 chars)

Delivery Settings:
- defaultDeliveryFee: number (default: 0)
- freeDeliveryThreshold: number (default: 0)

Tax Settings:
- automaticTax: boolean (default: false)
- taxBehavior: "unspecified" | "exclusive" | "inclusive"

==================== COMPARISON: STRIPE VS PAYMOB ====================

Feature              | Stripe                    | Paymob
---------------------|---------------------------|---------------------------
Currency             | 135+ currencies           | EGP, USD, SAR, AED, etc.
Card Payments        | ✓                         | ✓
Mobile Wallets       | Apple Pay, Google Pay     | Vodafone Cash, Orange, etc.
BNPL                 | Klarna, Afterpay          | ValU, Souhoola, SYMPL
Bank Transfers       | ACH, SEPA, iDEAL          | Kiosk (Aman, Masary)
3D Secure            | Full control              | ✓
Saved Cards          | ✓                         | ✓
Refunds              | API + Dashboard           | API + Dashboard
Capture Method       | Manual/Automatic          | Automatic
Webhooks             | Extensive events          | Transaction callbacks

*/
