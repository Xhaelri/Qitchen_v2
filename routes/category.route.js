import express from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
} from "../controllers/category.controller.js";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

const router = express.Router();

// router.use(jwtVerify);

router.post("/create-category", jwtVerify, checkAdminRole, createCategory);

router.get("/all-categories", getAllCategories);

router.get("/:categoryId", getCategoryById);

router.patch("/:categoryId", jwtVerify, checkAdminRole, updateCategory);

router.delete("/:categoryId", jwtVerify, checkAdminRole, deleteCategory);

export { router };
