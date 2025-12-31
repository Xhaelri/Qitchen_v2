import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Coupon from "../models/coupon.model.js";
import { calculateFinalCartPrice } from "../helpers/discount.helpers.js";


export const addProductToCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const { productId } = req.params;
    const { quantity = 1 } = req.body; // Accept quantity from request body

    // Validate quantity
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found with the given Product id",
      });
    }

    let cart = await Cart.findOne({ owner: userId });

    // Auto-create cart if it doesn't exist
    if (!cart) {
      cart = new Cart({
        owner: userId,
        products: [],
        totalPrice: 0,
        totalQuantity: 0,
      });
    }

    const existingProduct = cart.products.find(
      (p) => p.product.toString() === productId
    );

    if (existingProduct) {
      existingProduct.quantity += quantity;
    } else {
      cart.products.push({ product: productId, quantity: quantity });
    }

    cart.totalPrice += product.price * quantity;
    cart.totalQuantity += quantity;

    await cart.save();
    await cart.populate("products.product");
    
    return res.status(200).json({
      success: true,
      data: cart,
      message: `${quantity} item(s) added to cart successfully`,
    });
  } catch (error) {
    console.log("Error in addProductToCart function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const addMultipleProductsToCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User is not authenticated"
      });
    }

    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items must be a non-empty array"
      });
    }

    // Validate each item
    for (const item of items) {
      if (
        !item.productId ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Each item must include valid productId and quantity"
        });
      }
    }

    // Fetch all product IDs
    const productIds = items.map((i) => i.productId);
    const productsFromDB = await Product.find({ _id: { $in: productIds } });

    if (productsFromDB.length !== productIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more product IDs are invalid"
      });
    }

    let cart = await Cart.findOne({ owner: userId });

    if (!cart) {
      cart = new Cart({
        owner: userId,
        products: [],
        totalPrice: 0,
        totalQuantity: 0,
      });
    }

    // Process each incoming item
    for (const item of items) {
      const dbProduct = productsFromDB.find(
        (p) => p._id.toString() === item.productId
      );

      const existingProduct = cart.products.find(
        (p) => p.product.toString() === item.productId
      );

      if (existingProduct) {
        existingProduct.quantity += item.quantity;
      } else {
        cart.products.push({
          product: item.productId,
          quantity: item.quantity,
        });
      }

      // Update totals
      cart.totalPrice += dbProduct.price * item.quantity;
      cart.totalQuantity += item.quantity;
    }

    await cart.save();
    await cart.populate("products.product");

    return res.status(200).json({
      success: true,
      data: cart,
      message: "Products added to cart successfully",
    });
  } catch (error) {
    console.error("Error in addMultipleProductsToCart:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// NEW: Increment/Decrement quantity function
export const adjustProductQuantity = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;
    const { action, quantity = 1 } = req.body; // Default to 1 if not provided

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    if (!action || !['increase', 'decrease'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'increase' or 'decrease'",
      });
    }

    // Validate quantity
    if (quantity && (!Number.isInteger(quantity) || quantity < 1)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const cart = await Cart.findOne({ owner: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const existingProduct = cart.products.find(
      (p) => p.product.toString() === productId
    );
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    let message = "";
    const changeAmount = quantity; // Amount to increase/decrease

    if (action === 'increase') {
      existingProduct.quantity += changeAmount;
      cart.totalQuantity += changeAmount;
      cart.totalPrice += product.price * changeAmount;
      message = `Product quantity increased by ${changeAmount}`;
    } else if (action === 'decrease') {
      if (existingProduct.quantity <= changeAmount) {
        // Remove product if decreasing by more than or equal to current quantity
        const removedQuantity = existingProduct.quantity;
        
        await Cart.findByIdAndUpdate(cart._id, {
          $pull: { products: { product: productId } }
        });
        
        cart.totalQuantity -= removedQuantity;
        cart.totalPrice -= product.price * removedQuantity;
        message = "Product removed from cart";
      } else {
        existingProduct.quantity -= changeAmount;
        cart.totalQuantity -= changeAmount;
        cart.totalPrice -= product.price * changeAmount;
        message = `Product quantity decreased by ${changeAmount}`;
      }
    }

    // Ensure totals don't go negative
    cart.totalQuantity = Math.max(0, cart.totalQuantity);
    cart.totalPrice = Math.max(0, cart.totalPrice);

    await cart.save();
    await cart.populate("products.product");

    return res.status(200).json({
      success: true,
      data: cart,
      message: message,
    });
  } catch (error) {
    console.log("Error in adjustProductQuantity function", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const removeProductInstanceFromCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const cart = await Cart.findOne({ owner: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart with the given owner doesn't exist",
      });
    }

    const item = cart.products.find((p) => p.product.toString() === productId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found with the given Product id",
      });
    }

    item.quantity -= 1;
    cart.totalQuantity -= 1;
    cart.totalPrice -= product.price;

    if (item.quantity <= 0) {
      cart.products = cart.products.filter(
        (p) => p.product.toString() !== productId
      );
    }

    await cart.save();
    await cart.populate("products.product");
    
    return res.status(200).json({
      success: true,
      data: cart,
      message: "Product quantity decreased successfully",
    });
  } catch (error) {
    console.log("Error in removeProductInstanceFromCart function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const removeAllSameProductFromCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });

    const cart = await Cart.findOne({ owner: userId });
    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    const item = cart.products.find((p) => p.product.toString() === productId);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Product not in cart" });

    const product = await Product.findById(productId);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    cart.totalPrice -= product.price * item.quantity;
    cart.totalQuantity -= item.quantity;

    cart.products = cart.products.filter(
      (p) => p.product.toString() !== productId
    );

    await cart.save();
    await cart.populate("products.product");
    
    return res
      .status(200)
      .json({ 
        success: true, 
        data: cart, 
        message: "All instances removed successfully" 
      });
  } catch (error) {
    console.log("Error in removeAllSameProductFromCart function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const clearCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const cart = await Cart.findOne({ owner: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.products = [];
    cart.totalPrice = 0;
    cart.totalQuantity = 0;

    await cart.save();

    return res.status(200).json({
      success: true,
      data: cart,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.log("Error in clearCart function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const cart = await Cart.findOneAndDelete({
      owner: userId,
    });

    if (!cart) {
      return res.status(404).json({ 
        success: false, 
        message: "Cart not found" 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Cart deleted successfully" 
    });
  } catch (error) {
    console.log("Error in deleteCart function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getCart = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });

    const cart = await Cart.findOne({ owner: userId }).populate(
      "products.product"
    );

    if (!cart) {
      // Return empty cart structure instead of 404
      return res.status(200).json({
        success: true,
        cart: {
          _id: null,
          products: [],
          totalQuantity: 0,
          totalPrice: 0,
        },
      });
    }

    const productDetails = cart.products.map((p) => ({
      product: p.product,
      quantity: p.quantity,
    }));

    return res.status(200).json({
      success: true,
      cart: {
        _id: cart._id,
        products: productDetails,
        totalQuantity: cart.totalQuantity,
        totalPrice: cart.totalPrice,
      },
    });
  } catch (error) {
    console.error("getCart error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCartByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required" 
      });
    }

    const cart = await Cart.findOne({ owner: userId }).populate(
      "products.product"
    );

    if (!cart) {
      return res.status(200).json({
        success: true,
        cart: {
          _id: null,
          products: [],
          totalQuantity: 0,
          totalPrice: 0,
        },
      });
    }

    const productDetails = cart.products.map((p) => ({
      product: p.product,
      quantity: p.quantity,
    }));

    return res.status(200).json({
      success: true,
      cart: {
        _id: cart._id,
        products: productDetails,
        totalQuantity: cart.totalQuantity,
        totalPrice: cart.totalPrice,
      },
    });
  } catch (error) {
    console.log("Error in getCartByUserId function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};



// ==================== COUPON OPERATIONS ====================

/**
 * Apply coupon to cart (Customer)
 * POST /api/v2/cart/apply-coupon
 */
export const applyCouponToCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { couponCode } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    // Find cart
    const cart = await Cart.findOne({ owner: userId }).populate("products.product");
    if (!cart || cart.products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Find and validate coupon
    const couponResult = await Coupon.findValidCoupon(couponCode);
    if (!couponResult.success) {
      return res.status(400).json({
        success: false,
        message: couponResult.message,
      });
    }

    const coupon = couponResult.coupon;

    // Check if user can use this coupon
    const userCheck = coupon.canUserUse(userId);
    if (!userCheck.canUse) {
      return res.status(400).json({
        success: false,
        message: userCheck.message,
      });
    }

    // Calculate cart with coupon
    const cartCalculation = await calculateFinalCartPrice(
      cart.products,
      coupon._id,
      userId
    );

    if (!cartCalculation.appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon could not be applied to your cart",
      });
    }

    // Update cart
    cart.appliedCoupon = coupon._id;
    cart.subtotal = cartCalculation.subtotal;
    cart.couponDiscount = cartCalculation.couponDiscount;
    cart.totalDiscount = cartCalculation.totalDiscount;
    cart.totalPrice = cartCalculation.finalTotal;

    await cart.save();
    await cart.populate("appliedCoupon");

    return res.status(200).json({
      success: true,
      data: {
        cart,
        discountBreakdown: {
          subtotal: cartCalculation.subtotal,
          productDiscounts: cartCalculation.productDiscounts,
          couponDiscount: cartCalculation.couponDiscount,
          totalDiscount: cartCalculation.totalDiscount,
          finalTotal: cartCalculation.finalTotal,
          freeDelivery: cartCalculation.freeDelivery,
        },
      },
      message: `Coupon ${coupon.code} applied successfully`,
    });
  } catch (error) {
    console.error("Error in applyCouponToCart:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove coupon from cart (Customer)
 * POST /api/v2/cart/remove-coupon
 */
export const removeCouponFromCart = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const cart = await Cart.findOne({ owner: userId }).populate("products.product");
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (!cart.appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: "No coupon applied to cart",
      });
    }

    // Recalculate without coupon
    const cartCalculation = await calculateFinalCartPrice(cart.products, null, userId);

    cart.appliedCoupon = null;
    cart.subtotal = cartCalculation.subtotal;
    cart.couponDiscount = 0;
    cart.totalDiscount = cartCalculation.productDiscounts;
    cart.totalPrice = cartCalculation.finalTotal;

    await cart.save();

    return res.status(200).json({
      success: true,
      data: cart,
      message: "Coupon removed successfully",
    });
  } catch (error) {
    console.error("Error in removeCouponFromCart:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get cart with detailed discount breakdown (Customer)
 * GET /api/v2/cart/get-cart-with-discounts
 */
export const getCartWithDiscounts = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const cart = await Cart.findOne({ owner: userId })
      .populate("products.product")
      .populate("appliedCoupon");

    if (!cart || cart.products.length === 0) {
      return res.status(200).json({
        success: true,
        cart: {
          _id: null,
          products: [],
          totalQuantity: 0,
          subtotal: 0,
          totalDiscount: 0,
          totalPrice: 0,
          appliedCoupon: null,
        },
      });
    }

    // Recalculate prices with current discounts
    const cartCalculation = await calculateFinalCartPrice(
      cart.products,
      cart.appliedCoupon?._id,
      userId
    );

    // Update cart with latest calculations
    cart.subtotal = cartCalculation.subtotal;
    cart.couponDiscount = cartCalculation.couponDiscount;
    cart.totalDiscount = cartCalculation.totalDiscount;
    cart.totalPrice = cartCalculation.finalTotal;
    await cart.save();

    return res.status(200).json({
      success: true,
      cart: {
        _id: cart._id,
        products: cartCalculation.itemsWithPrices.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          originalUnitPrice: item.originalUnitPrice,
          unitDiscount: item.unitDiscount,
          itemTotal: item.itemTotal,
          itemDiscount: item.itemDiscount,
          discountType: item.discountType,
          discountPercentage: item.discountPercentage,
        })),
        totalQuantity: cart.totalQuantity,
        subtotal: cartCalculation.subtotal,
        productDiscounts: cartCalculation.productDiscounts,
        couponDiscount: cartCalculation.couponDiscount,
        totalDiscount: cartCalculation.totalDiscount,
        totalPrice: cartCalculation.finalTotal,
        appliedCoupon: cart.appliedCoupon ? {
          _id: cart.appliedCoupon._id,
          code: cart.appliedCoupon.code,
          description: cart.appliedCoupon.description,
          discountType: cart.appliedCoupon.discountType,
          discountValue: cart.appliedCoupon.discountValue,
        } : null,
        freeDelivery: cartCalculation.freeDelivery,
      },
      message: "Cart fetched successfully",
    });
  } catch (error) {
    console.error("getCartWithDiscounts error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};