// coupon.route.js
import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  validateCoupon,
} from "../controllers/coupon.controller.js";

const router = express.Router();

// Customer routes (require authentication)
router.get("/validate/:code", jwtVerify, validateCoupon);

// Admin routes (require authentication + admin role)
router.post("/create", jwtVerify, checkAdminRole, createCoupon);
router.get("/all", jwtVerify, checkAdminRole, getAllCoupons);
router.get("/:couponId", jwtVerify, checkAdminRole, getCouponById);
router.patch("/:couponId", jwtVerify, checkAdminRole, updateCoupon);
router.patch("/:couponId/toggle", jwtVerify, checkAdminRole, toggleCouponStatus);
router.delete("/:couponId", jwtVerify, checkAdminRole, deleteCoupon);

export { router };

/*
==================== ROUTE SUMMARY ====================

CUSTOMER (JWT only):
GET    /api/v2/coupon/validate/:code               - Validate coupon code

ADMIN (JWT + Admin Role):
POST   /api/v2/coupon/create                       - Create coupon
GET    /api/v2/coupon/all                          - Get all coupons
GET    /api/v2/coupon/:couponId                    - Get coupon by ID
PATCH  /api/v2/coupon/:couponId                    - Update coupon
PATCH  /api/v2/coupon/:couponId/toggle             - Toggle active status
DELETE /api/v2/coupon/:couponId                    - Delete coupon

==================== BODY EXAMPLES ====================

CREATE COUPON (Percentage):
{
  "code": "SAVE20",
  "description": "20% off your order",
  "discountType": "percentage",
  "discountValue": 20,
  "maxDiscountAmount": 100,
  "minOrderAmount": 200,
  "maxUsageCount": 1000,
  "maxUsagePerUser": 1,
  "startDate": "2025-01-01T00:00:00Z",
  "expiryDate": "2025-12-31T23:59:59Z",
  "isGlobal": true
}

CREATE COUPON (Fixed Amount):
{
  "code": "FLAT50",
  "description": "50 EGP off",
  "discountType": "fixed",
  "discountValue": 50,
  "minOrderAmount": 200,
  "maxUsageCount": 500,
  "maxUsagePerUser": 2,
  "expiryDate": "2025-06-30T23:59:59Z",
  "applicableProducts": [],
  "applicableCategories": ["categoryId1", "categoryId2"],
  "isGlobal": false
}

CREATE COUPON (Free Delivery):
{
  "code": "FREESHIP",
  "description": "Free delivery on all orders",
  "discountType": "freeDelivery",
  "minOrderAmount": 100,
  "maxUsagePerUser": 3,
  "expiryDate": "2025-03-31T23:59:59Z",
  "isGlobal": true
}

UPDATE COUPON:
{
  "maxUsageCount": 2000,
  "expiryDate": "2025-12-31T23:59:59Z"
}
*/
