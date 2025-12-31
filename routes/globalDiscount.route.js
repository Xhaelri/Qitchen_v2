// globalDiscount.route.js
import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";
import {
  createGlobalDiscount,
  getAllGlobalDiscounts,
  getActiveGlobalDiscount,
  getGlobalDiscountById,
  updateGlobalDiscount,
  toggleGlobalDiscount,
  deleteGlobalDiscount,
} from "../controllers/globalDiscount.controller.js";

const router = express.Router();

// Public route - get active discount
router.get("/active", getActiveGlobalDiscount);

// All routes below require admin authentication
router.use(jwtVerify, checkAdminRole);

// Admin routes
router.post("/", createGlobalDiscount);
router.get("/", getAllGlobalDiscounts);
router.get("/:discountId", getGlobalDiscountById);
router.patch("/:discountId", updateGlobalDiscount);
router.patch("/:discountId/toggle", toggleGlobalDiscount);
router.delete("/:discountId", deleteGlobalDiscount);

export { router };

/*
==================== ROUTE SUMMARY ====================

PUBLIC:
GET    /api/v2/discount/global/active              - Get active global discount

ADMIN (JWT + Admin Role):
POST   /api/v2/discount/global                     - Create global discount
GET    /api/v2/discount/global                     - Get all global discounts
GET    /api/v2/discount/global/:discountId         - Get discount by ID
PATCH  /api/v2/discount/global/:discountId         - Update discount
PATCH  /api/v2/discount/global/:discountId/toggle  - Toggle active status
DELETE /api/v2/discount/global/:discountId         - Delete discount

==================== BODY EXAMPLES ====================

CREATE GLOBAL DISCOUNT:
{
  "name": "New Year Sale 2025",
  "description": "20% off everything",
  "discountPercentage": 20,
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-07T23:59:59Z",
  "excludedProducts": ["productId1", "productId2"],
  "excludedCategories": ["categoryId1"]
}

UPDATE GLOBAL DISCOUNT:
{
  "discountPercentage": 25,
  "endDate": "2025-01-10T23:59:59Z"
}
*/
