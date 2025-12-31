// delivery.route.js
// ✅ Delivery location routes - Public + Admin endpoints

import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";

import {
  // Public
  getGovernorates,
  getCitiesByGovernorate,
  getDeliveryFee,
  getActiveDeliveryLocations,
  
  // Admin
  getAllDeliveryLocations,
  createDeliveryLocation,
  updateDeliveryLocation,
  toggleDeliveryLocation,
  deleteDeliveryLocation,
  bulkCreateDeliveryLocations,
} from "../controllers/delivery.controller.js";

const router = express.Router();

// ==================== PUBLIC ROUTES (No Auth) ====================

// GET /api/v2/delivery/governorates - List of governorates
router.get("/governorates", getGovernorates);

// GET /api/v2/delivery/governorates/:governorate/cities - Cities in governorate
router.get("/governorates/:governorate/cities", getCitiesByGovernorate);

// GET /api/v2/delivery/fee?governorate=X&city=Y - Get delivery fee
router.get("/fee", getDeliveryFee);

// GET /api/v2/delivery/locations - All active locations
router.get("/locations", getActiveDeliveryLocations);

// ==================== ADMIN ROUTES (JWT + Admin Role) ====================

// GET /api/v2/delivery/all - All locations (including inactive)
router.get("/all", jwtVerify, checkAdminRole, getAllDeliveryLocations);

// POST /api/v2/delivery - Create location
router.post("/", jwtVerify, checkAdminRole, createDeliveryLocation);

// POST /api/v2/delivery/bulk - Bulk create locations
router.post("/bulk", jwtVerify, checkAdminRole, bulkCreateDeliveryLocations);

// PATCH /api/v2/delivery/:locationId - Update location
router.patch("/:locationId", jwtVerify, checkAdminRole, updateDeliveryLocation);

// PATCH /api/v2/delivery/:locationId/toggle - Toggle active status
router.patch("/:locationId/toggle", jwtVerify, checkAdminRole, toggleDeliveryLocation);

// DELETE /api/v2/delivery/:locationId - Delete location
router.delete("/:locationId", jwtVerify, checkAdminRole, deleteDeliveryLocation);

export { router };

/*
==================== ROUTE SUMMARY ====================

PUBLIC (No Auth):
GET    /api/v2/delivery/governorates                    - List governorates
GET    /api/v2/delivery/governorates/:gov/cities        - Cities in governorate
GET    /api/v2/delivery/fee?governorate=X&city=Y        - Get delivery fee
GET    /api/v2/delivery/locations                       - All active locations

ADMIN (JWT + Admin Role):
GET    /api/v2/delivery/all                             - All locations (inc. inactive)
POST   /api/v2/delivery                                 - Create location
POST   /api/v2/delivery/bulk                            - Bulk create
PATCH  /api/v2/delivery/:locationId                     - Update location
PATCH  /api/v2/delivery/:locationId/toggle              - Toggle active
DELETE /api/v2/delivery/:locationId                     - Delete location

*/
