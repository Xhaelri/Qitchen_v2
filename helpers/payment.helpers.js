import DeliveryLocation from "../models/deliveryLocation.model.js";
import PaymentMethod from "../models/paymentMethod.model.js";
import StripeConfig from "../models/stripConfig.model.js";

// Helper function for validation (used in order controller)
export const validatePaymentMethod = async (paymentMethodName) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      name: paymentMethodName,
      isActive: true,
    });

    if (!paymentMethod) {
      return {
        success: false,
        message: `${paymentMethodName} payment method is currently unavailable. Please choose another payment method.`,
        statusCode: 400,
      };
    }

    return {
      success: true,
      paymentMethod,
    };
  } catch (error) {
    return {
      success: false,
      message: "Error validating payment method",
      statusCode: 500,
    };
  }
};


// ==================== HELPER FUNCTIONS ====================

// Helper function to calculate delivery fee
export const calculateDeliveryFee = async (placeType, governorate, city, subtotal) => {
  if (placeType !== "Online") {
    return 0; // No delivery fee for In-Place or Takeaway
  }

  if (!governorate || !city) {
    throw new Error("Governorate and city are required for online orders");
  }

  const location = await DeliveryLocation.findOne({
    governorate,
    city,
    isActive: true,
  });

  if (!location) {
    throw new Error(`Delivery not available for ${city}, ${governorate}`);
  }

  // Check for free delivery threshold
  const config = await StripeConfig.findOne({ isActive: true });
  if (config && config.freeDeliveryThreshold > 0 && subtotal >= config.freeDeliveryThreshold) {
    return 0;
  }

  return location.deliveryFee;
};

// Helper function to validate order amount against config
export const validateOrderAmount = async (totalPrice) => {
  const config = await StripeConfig.findOne({ isActive: true });
  
  if (config) {
    if (config.minOrderAmount > 0 && totalPrice < config.minOrderAmount) {
      return {
        success: false,
        message: `Minimum order amount is ${config.minOrderAmount}`,
        statusCode: 400,
      };
    }
    
    if (config.maxOrderAmount > 0 && totalPrice > config.maxOrderAmount) {
      return {
        success: false,
        message: `Maximum order amount is ${config.maxOrderAmount}`,
        statusCode: 400,
      };
    }
  }
  
  return { success: true };
};