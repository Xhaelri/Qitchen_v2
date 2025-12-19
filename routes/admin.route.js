import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";
import {
  createPaymentMethod,
  getAllPaymentMethods,
  getActivePaymentMethods,
  updatePaymentMethod,

  // Stripe Configuration
  getStripeConfig,
  updateStripeConfig,

  // Delivery Locations
  createDeliveryLocation,
  getAllDeliveryLocations,
  getActiveDeliveryLocations,
  getGovernorates,
  getCitiesByGovernorate,
  getDeliveryFee,
  updateDeliveryLocation,
  deleteDeliveryLocation,
  bulkCreateDeliveryLocations,

  
} from "../controllers/admin.controller.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.use(jwtVerify);

// Payment Method Management Routes
router.post("/payment-method",upload.array("image", 1), createPaymentMethod);
router.get("/payment-methods", getAllPaymentMethods);
router.get("/payment-methods/active", getActivePaymentMethods);
router.patch("/payment-method/:paymentMethodId",upload.array("image", 1), updatePaymentMethod);

// ==================== STRIPE CONFIGURATION ROUTES ====================
router.get("/stripe-config", checkAdminRole , getStripeConfig);
router.patch("/stripe-config", updateStripeConfig);

// ==================== DELIVERY LOCATION ROUTES ====================
router.post("/delivery-locations",  checkAdminRole , createDeliveryLocation);
router.post("/delivery-locations/bulk",  checkAdminRole , bulkCreateDeliveryLocations);
router.get("/delivery-locations", getAllDeliveryLocations);
router.get("/delivery-locations/active", getActiveDeliveryLocations);
router.get("/delivery-locations/governorates", getGovernorates);
router.get("/delivery-locations/governorates/:governorate/cities", getCitiesByGovernorate);
router.get("/delivery-locations/fee", getDeliveryFee);
router.patch("/delivery-locations/:locationId",  checkAdminRole , updateDeliveryLocation);
router.delete("/delivery-locations/:locationId",  checkAdminRole , deleteDeliveryLocation);

export { router };
