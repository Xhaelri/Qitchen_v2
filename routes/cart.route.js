// cart.route.js - UPDATED VERSION
import express from "express";
import {
  addProductToCart,
  getCartByUserId,
  deleteCart,
  getCart,
  removeProductInstanceFromCart,
  removeAllSameProductFromCart,
  clearCart,
  adjustProductQuantity,
  addMultipleProductsToCart,
  // ✅ NEW: Coupon operations
  applyCouponToCart,
  removeCouponFromCart,
  getCartWithDiscounts,
} from "../controllers/cart.controller.js";
import jwtVerify from "../middleware/auth.middleware.js";

const router = express.Router();

// All cart routes require authentication
router.use(jwtVerify);

// ==================== CART OPERATIONS ====================

// Get cart
router.get("/get-cart", getCart);

// ✅ NEW: Get cart with detailed discount breakdown
router.get("/get-cart-with-discounts", getCartWithDiscounts);

// Get cart by user ID (admin)
router.get("/get-cart/:userId", getCartByUserId);

// ==================== PRODUCT OPERATIONS ====================

// Add single product
router.post("/add-product/:productId", addProductToCart);

// Add multiple products
router.post("/add-multiple-products", addMultipleProductsToCart);

// Adjust product quantity
router.patch("/adjust-quantity/:productId", adjustProductQuantity);

// Remove one instance of product
router.patch("/:productId", removeProductInstanceFromCart);

// Remove all instances of same product
router.patch("/remove-all-same-products/:productId", removeAllSameProductFromCart);

// ==================== COUPON OPERATIONS ====================

// ✅ NEW: Apply coupon
router.post("/apply-coupon", applyCouponToCart);

// ✅ NEW: Remove coupon
router.post("/remove-coupon", removeCouponFromCart);

// ==================== CART MANAGEMENT ====================

// Clear cart
router.patch("/clear-cart", clearCart);

// Delete cart
router.delete("/:productId", deleteCart);

export { router };
