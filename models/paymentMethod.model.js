// paymentMethod.model.js
// ✅ SINGLE SOURCE OF TRUTH for payment method activation
import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: [
        "Card",           // Stripe
        "COD",            // Internal (Cash on Delivery)
        "Paymob-Card",    // Paymob Card
        "Paymob-Wallet",  // Paymob Mobile Wallet
        "Paymob-Kiosk",   // Paymob Kiosk (Aman, Masary)
        "Paymob-Installments", // Paymob Bank Installments
        "Paymob-ValU",    // Paymob ValU BNPL
      ],
      required: true,
      unique: true,
    },
    
    // Provider information
    provider: {
      type: String,
      enum: ["Stripe", "Paymob", "Internal"],
      required: true,
    },
    
    // ✅ THIS IS THE SINGLE SOURCE OF TRUTH FOR ENABLING/DISABLING
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Display information
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    
    // Images for UI
    image: {
      type: [String],
      required: true,
      validate: {
        validator: function (array) {
          return array.length > 0;
        },
        message: "At least one image is required",
      },
    },
    imagePublicId: {
      type: [String],
    },
    
    // Display order in UI
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ==================== INDEXES ====================
paymentMethodSchema.index({ isActive: 1 });
paymentMethodSchema.index({ provider: 1 });
paymentMethodSchema.index({ sortOrder: 1 });

// ==================== STATIC METHODS ====================

/**
 * Get all active payment methods
 */
paymentMethodSchema.statics.getActiveMethods = async function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

/**
 * Check if a payment method is active by name
 * @param {string} methodName - Payment method name
 * @returns {Promise<boolean>}
 */
paymentMethodSchema.statics.isMethodActive = async function (methodName) {
  const method = await this.findOne({ name: methodName });
  return method?.isActive ?? false;
};

/**
 * Get payment method by name
 * @param {string} methodName - Payment method name
 * @returns {Promise<Object|null>}
 */
paymentMethodSchema.statics.getByName = async function (methodName) {
  return this.findOne({ name: methodName });
};

/**
 * Get active methods by provider
 * @param {string} provider - 'Stripe', 'Paymob', or 'Internal'
 * @returns {Promise<Array>}
 */
paymentMethodSchema.statics.getActiveByProvider = async function (provider) {
  return this.find({ provider, isActive: true }).sort({ sortOrder: 1 });
};

/**
 * Toggle payment method active status
 * @param {string} methodName - Payment method name
 * @param {boolean} isActive - New active status (optional, toggles if not provided)
 * @returns {Promise<Object>}
 */
paymentMethodSchema.statics.toggleMethod = async function (methodName, isActive) {
  const method = await this.findOne({ name: methodName });
  
  if (!method) {
    throw new Error(`Payment method '${methodName}' not found`);
  }
  
  method.isActive = isActive !== undefined ? isActive : !method.isActive;
  await method.save();
  
  return method;
};

/**
 * Get payment method ID by name
 * @param {string} methodName - Payment method name
 * @returns {Promise<ObjectId>}
 * @throws {Error} If payment method not found
 */
paymentMethodSchema.statics.getIdByName = async function (methodName) {
  const method = await this.findOne({ name: methodName });
  if (!method) {
    throw new Error(`Payment method '${methodName}' not found`);
  }
  return method._id;
};

const PaymentMethod = mongoose.model("PaymentMethod", paymentMethodSchema);

export default PaymentMethod;