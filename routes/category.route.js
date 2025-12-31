// category.route.js - FIXED VERSION
import express from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  setCategoryDiscount,
  removeCategoryDiscount,
  getCategoryWithDiscount,
  getCategoriesWithDiscounts,
} from "../controllers/category.controller.js";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

const router = express.Router();

// ==================== ADMIN ROUTES ====================

// Create category
router.post("/create-category", jwtVerify, checkAdminRole, createCategory);

// Category discount management
router.patch(
  "/:categoryId/discount",
  jwtVerify,
  checkAdminRole,
  setCategoryDiscount
);

router.patch(
  "/:categoryId/discount/remove",
  jwtVerify,
  checkAdminRole,
  removeCategoryDiscount
);

// Update category
router.patch("/:categoryId", jwtVerify, checkAdminRole, updateCategory);

// Delete category
router.delete("/:categoryId", jwtVerify, checkAdminRole, deleteCategory);

// ==================== PUBLIC ROUTES ====================

// ✅ STATIC FIRST
router.get("/all-categories", getAllCategories);
router.get("/with-discounts", getCategoriesWithDiscounts);

// ✅ SEMI-DYNAMIC
router.get("/:categoryId/with-discount", getCategoryWithDiscount);

// ✅ DYNAMIC LAST
router.get("/:categoryId", getCategoryById);

export { router };
