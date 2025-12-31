import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import checkAdminRole from "../middleware/role.middleware.js";
import {
  changeProductCategory,
  deleteProduct,
  getProductById,
  getProducts,
  getReviewsForProduct,
  productListing,
  toggleProductAvailability,
  updateListedProduct,
  addProductImages,
  deleteSingleImage,
  // ✅ NEW: Sale price management
  setProductSale,
  removeProductSale,
  getProductWithDiscount,
  getProductsOnSale,
} from "../controllers/product.controller.js";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all products
router.get("/get-all-products", getProducts);

// Get product by ID
router.get("/get-product/:productId", getProductById);

// ✅ NEW: Get product with discount info
router.get("/:productId/with-discount", getProductWithDiscount);

// ✅ NEW: Get products on sale
router.get("/on-sale", getProductsOnSale);

// Get product reviews
router.get("/get-product-reviews/:productId", getReviewsForProduct);

// ==================== ADMIN ROUTES ====================

// Product listing/creation
router.post(
  "/product-listing/:categoryId",
  jwtVerify,
  checkAdminRole,
  upload.array("productImages", 10),
  productListing
);

// Add product images
router.post(
  "/add-product-images/:productId",
  jwtVerify,
  checkAdminRole,
  upload.array("productImages", 10),
  addProductImages
);

// ✅ NEW: Sale price management
router.patch(
  "/:productId/sale",
  jwtVerify,
  checkAdminRole,
  setProductSale
);

router.patch(
  "/:productId/sale/remove",
  jwtVerify,
  checkAdminRole,
  removeProductSale
);

// Toggle product availability
router.patch(
  "/product-toggle-availability/:productId",
  jwtVerify,
  checkAdminRole,
  toggleProductAvailability
);

// Update product
router.patch(
  "/update-product/:productId",
  jwtVerify,
  checkAdminRole,
  updateListedProduct
);

// Delete product image
router.delete(
  "/delete-product-image/:productId/:publicId",
  jwtVerify,
  checkAdminRole,
  deleteSingleImage
);

// Change product category
router.patch(
  "/change-product-category/:productId/:categoryId",
  jwtVerify,
  checkAdminRole,
  changeProductCategory
);

// Delete product
router.delete(
  "/delete-product/:productId",
  jwtVerify,
  checkAdminRole,
  deleteProduct
);

export { router };

/*
==================== ROUTE SUMMARY ====================

PUBLIC:
GET    /api/v2/product/get-all-products                    - Get all products
GET    /api/v2/product/get-product/:productId              - Get product by ID
GET    /api/v2/product/:productId/with-discount            - Get product with discount info
GET    /api/v2/product/on-sale                             - Get products on sale
GET    /api/v2/product/get-product-reviews/:productId      - Get product reviews

ADMIN (JWT + Admin Role):
POST   /api/v2/product/product-listing/:categoryId         - Create product
POST   /api/v2/product/add-product-images/:productId       - Add images
PATCH  /api/v2/product/:productId/sale                     - Set sale price
PATCH  /api/v2/product/:productId/sale/remove              - Remove sale price
PATCH  /api/v2/product/product-toggle-availability/:productId - Toggle availability
PATCH  /api/v2/product/update-product/:productId           - Update product
PATCH  /api/v2/product/change-product-category/:productId/:categoryId - Change category
DELETE /api/v2/product/delete-product-image/:productId/:publicId - Delete image
DELETE /api/v2/product/delete-product/:productId           - Delete product

==================== NEW ENDPOINTS BODY EXAMPLES ====================

SET SALE PRICE:
PATCH /api/v2/product/:productId/sale
{
  "salePrice": 79.99,
  "saleStartDate": "2025-01-01T00:00:00Z",
  "saleEndDate": "2025-01-31T23:59:59Z",
  "isOnSale": true
}

REMOVE SALE PRICE:
PATCH /api/v2/product/:productId/sale/remove
(No body required)
*/
