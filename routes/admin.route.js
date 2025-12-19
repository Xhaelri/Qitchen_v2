import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";
import {
  createPaymentMethod,
  getAllPaymentMethods,
  getActivePaymentMethods,
  updatePaymentMethod,
} from "../controllers/admin.controller.js";

const router = express.Router();

// All routes require admin authentication
router.use(jwtVerify, checkAdminRole);

// Payment Method Management Routes
router.post("/payment-method", createPaymentMethod);
router.get("/payment-methods", getAllPaymentMethods);
router.get("/payment-methods/active", getActivePaymentMethods);
router.patch("/payment-method/:paymentMethodId", updatePaymentMethod);

export { router };