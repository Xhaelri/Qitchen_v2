// helpers/discount.helpers.js
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import GlobalDiscount from "../models/globalDiscount.model.js";
import Coupon from "../models/coupon.model.js";

/**
 * Calculate effective price for a product considering all discount types
 * Priority: Product Sale > Category Discount > Global Discount
 */
export const calculateProductPrice = async (product, categoryDiscount = null, globalDiscount = null) => {
  // Ensure product is populated if it's just an ID
  if (typeof product === 'string') {
    product = await Product.findById(product).populate('category');
  }
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Get category discount if not provided
  if (!categoryDiscount && product.category) {
    const category = typeof product.category === 'string' 
      ? await Category.findById(product.category)
      : product.category;
    
    if (category) {
      categoryDiscount = category.getCurrentDiscount();
    }
  }
  
  // Get global discount if not provided
  if (!globalDiscount) {
    globalDiscount = await GlobalDiscount.getActiveDiscount();
  }
  
  // Check if product is excluded from global discount
  if (globalDiscount) {
    const isProductExcluded = globalDiscount.excludedProducts?.some(
      id => id.toString() === product._id.toString()
    );
    const isCategoryExcluded = globalDiscount.excludedCategories?.some(
      id => id.toString() === product.category._id?.toString() || id.toString() === product.category?.toString()
    );
    
    if (isProductExcluded || isCategoryExcluded) {
      globalDiscount = null;
    }
  }
  
  return product.getEffectivePrice(categoryDiscount, globalDiscount);
};

/**
 * Calculate cart totals with all discounts applied
 */
export const calculateCartTotals = async (cartProducts) => {
  let subtotal = 0;
  let totalDiscount = 0;
  const itemsWithPrices = [];
  
  // Get global discount once
  const globalDiscount = await GlobalDiscount.getActiveDiscount();
  
  for (const item of cartProducts) {
    const product = await Product.findById(item.product).populate('category');
    
    if (!product) continue;
    
    const category = product.category;
    const categoryDiscount = category ? category.getCurrentDiscount() : null;
    
    const priceInfo = await calculateProductPrice(product, categoryDiscount, globalDiscount);
    
    const itemTotal = priceInfo.price * item.quantity;
    const itemDiscount = priceInfo.discount * item.quantity;
    
    subtotal += itemTotal;
    totalDiscount += itemDiscount;
    
    itemsWithPrices.push({
      product: product,
      quantity: item.quantity,
      unitPrice: priceInfo.price,
      originalUnitPrice: priceInfo.originalPrice,
      unitDiscount: priceInfo.discount,
      itemTotal: itemTotal,
      itemDiscount: itemDiscount,
      discountType: priceInfo.discountType,
      discountPercentage: priceInfo.discountPercentage,
    });
  }
  
  return {
    subtotal,
    totalDiscount,
    itemsWithPrices,
  };
};

/**
 * Apply coupon to cart
 */
export const applyCouponToCart = async (coupon, cartSubtotal, cartProducts, userId) => {
  // Validate coupon
  const validity = coupon.isValid();
  if (!validity.valid) {
    return { success: false, message: validity.message };
  }
  
  // Check user usage
  const userCheck = coupon.canUserUse(userId);
  if (!userCheck.canUse) {
    return { success: false, message: userCheck.message };
  }
  
  // Check minimum order amount
  if (coupon.minOrderAmount > 0 && cartSubtotal < coupon.minOrderAmount) {
    return {
      success: false,
      message: `Minimum order amount of ${coupon.minOrderAmount} required`,
    };
  }
  
  // Check if coupon applies to cart products
  if (!coupon.isGlobal) {
    const hasApplicableProducts = await checkCouponApplicability(
      coupon,
      cartProducts
    );
    
    if (!hasApplicableProducts) {
      return {
        success: false,
        message: "Coupon is not applicable to items in your cart",
      };
    }
  }
  
  // Calculate discount
  let discount = 0;
  let freeDelivery = false;
  
  switch (coupon.discountType) {
    case "percentage":
      discount = (cartSubtotal * coupon.discountValue) / 100;
      // Apply max discount cap if set
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
      break;
      
    case "fixed":
      discount = Math.min(coupon.discountValue, cartSubtotal);
      break;
      
    case "freeDelivery":
      freeDelivery = true;
      discount = 0; // Will be applied to delivery fee
      break;
  }
  
  return {
    success: true,
    discount: Math.round(discount * 100) / 100,
    freeDelivery,
    coupon,
  };
};

/**
 * Check if coupon is applicable to cart products
 */
const checkCouponApplicability = async (coupon, cartProducts) => {
  if (coupon.isGlobal) return true;
  
  for (const item of cartProducts) {
    const product = await Product.findById(item.product);
    
    if (!product) continue;
    
    // Check if product is in applicable products list
    if (
      coupon.applicableProducts.length > 0 &&
      coupon.applicableProducts.some(id => id.toString() === product._id.toString())
    ) {
      return true;
    }
    
    // Check if product's category is in applicable categories list
    if (
      coupon.applicableCategories.length > 0 &&
      coupon.applicableCategories.some(id => id.toString() === product.category.toString())
    ) {
      return true;
    }
  }
  
  return false;
};

/**
 * Calculate final cart price with all discounts and coupon
 */
export const calculateFinalCartPrice = async (cartProducts, appliedCouponId = null, userId = null) => {
  // Calculate base cart totals (with product/category/global discounts)
  const cartTotals = await calculateCartTotals(cartProducts);
  
  let couponDiscount = 0;
  let freeDelivery = false;
  let appliedCoupon = null;
  
  // Apply coupon if provided
  if (appliedCouponId) {
    const coupon = await Coupon.findById(appliedCouponId);
    
    if (coupon) {
      const couponResult = await applyCouponToCart(
        coupon,
        cartTotals.subtotal,
        cartProducts,
        userId
      );
      
      if (couponResult.success) {
        couponDiscount = couponResult.discount;
        freeDelivery = couponResult.freeDelivery;
        appliedCoupon = coupon;
      }
    }
  }
  
  const finalTotal = Math.max(0, cartTotals.subtotal - couponDiscount);
  
  return {
    subtotal: cartTotals.subtotal,
    productDiscounts: cartTotals.totalDiscount,
    couponDiscount,
    totalDiscount: cartTotals.totalDiscount + couponDiscount,
    finalTotal,
    freeDelivery,
    appliedCoupon,
    itemsWithPrices: cartTotals.itemsWithPrices,
  };
};

export default {
  calculateProductPrice,
  calculateCartTotals,
  applyCouponToCart,
  calculateFinalCartPrice,
};
