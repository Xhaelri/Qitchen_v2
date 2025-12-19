import PaymentMethod from "../models/paymentMethod.model.js";


// Create a new payment method
export const createPaymentMethod = async (req, res) => {
  try {
    const { name, displayName, description, isActive } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: "Name and displayName are required",
      });
    }

    // Validate name is either "Card" or "COD"
    if (!["Card", "COD"].includes(name)) {
      return res.status(400).json({
        success: false,
        message: "Payment method name must be either 'Card' or 'COD'",
      });
    }

    // Check if payment method already exists
    const existingMethod = await PaymentMethod.findOne({ name });

    if (existingMethod) {
      return res.status(409).json({
        success: false,
        message: `Payment method '${name}' already exists. Use update endpoint to modify it.`,
      });
    }

    // Create new
    const paymentMethod = await PaymentMethod.create({
      name,
      displayName,
      description: description || "",
      isActive: isActive !== undefined ? isActive : true,
    });

    return res.status(201).json({
      success: true,
      data: paymentMethod,
      message: "Payment method created successfully",
    });
  } catch (error) {
    console.error("Error in createPaymentMethod:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all payment methods
export const getAllPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find().sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: paymentMethods,
      message: "Payment methods fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllPaymentMethods:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get only active payment methods (for customers)
export const getActivePaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({ isActive: true }).sort({
      name: 1,
    });

    return res.status(200).json({
      success: true,
      data: paymentMethods,
      message: "Active payment methods fetched successfully",
    });
  } catch (error) {
    console.error("Error in getActivePaymentMethods:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update payment method (can update displayName, description, and isActive)
export const updatePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const { displayName, description, isActive } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method ID is required",
      });
    }

    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (description !== undefined) updates.description = description;
    if (typeof isActive === "boolean") updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field (displayName, description, or isActive) is required",
      });
    }

    const paymentMethod = await PaymentMethod.findByIdAndUpdate(
      paymentMethodId,
      updates,
      { new: true }
    );

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: paymentMethod,
      message: "Payment method updated successfully",
    });
  } catch (error) {
    console.error("Error in updatePaymentMethod:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};