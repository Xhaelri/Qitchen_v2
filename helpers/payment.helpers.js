import PaymentMethod from "../models/paymentMethod.model.js";

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
