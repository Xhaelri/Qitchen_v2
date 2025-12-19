import PaymentMethod from "../models/paymentMethod.model.js";
import StripeConfig from "../models/stripConfig.model.js";
import DeliveryLocation from "../models/deliveryLocation.model.js";
import {
  uploadOnCloudinary,
  destroyFromCloudinary,
} from "../utils/cloudinary.js";

// Create a new payment method
export const createPaymentMethod = async (req, res) => {
  try {
    const { name, displayName, description, isActive } = req.body || {};

    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: "Name and displayName are required",
      });
    }

    if (!["Card", "COD"].includes(name)) {
      return res.status(400).json({
        success: false,
        message: "Payment method name must be either 'Card' or 'COD'",
      });
    }

    const existingMethod = await PaymentMethod.findOne({ name });
    if (existingMethod) {
      return res.status(409).json({
        success: false,
        message: `Payment method '${name}' already exists`,
      });
    }

    let images = [];
    let imagePublicIds = [];

    if (req.files?.length) {
      const uploadedImages = [];

      for (const file of req.files) {
        const result = await uploadOnCloudinary(
          file.buffer,
          file.originalname,
          "payment-methods"
        );

        uploadedImages.push(result);
      }

      images = uploadedImages.map((img) => img.secure_url);
      imagePublicIds = uploadedImages.map((img) => img.public_id);
    }

    const paymentMethod = await PaymentMethod.create({
      name,
      displayName,
      description: description || "",
      isActive: isActive !== undefined ? isActive === "true" : true,
      image: images,
      imagePublicId: imagePublicIds,
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
    const { displayName, description, isActive } = req.body || {};

    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    if (displayName !== undefined) paymentMethod.displayName = displayName;
    if (description !== undefined) paymentMethod.description = description;
    if (isActive !== undefined) paymentMethod.isActive = isActive === "true";

    if (req.files?.length) {
      if (paymentMethod.imagePublicId?.length) {
        await destroyMultipleFromCloudinary(paymentMethod.imagePublicId);
      }

      const uploadedImages = [];

      for (const file of req.files) {
        const result = await uploadOnCloudinary(
          file.buffer,
          file.originalname,
          "payment-methods"
        );
        uploadedImages.push(result);
      }

      paymentMethod.image = uploadedImages.map((img) => img.secure_url);
      paymentMethod.imagePublicId = uploadedImages.map((img) => img.public_id);
    }

    await paymentMethod.save();

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

// ==================== STRIPE CONFIGURATION ====================

// Get Stripe Configuration
export const getStripeConfig = async (req, res) => {
  try {
    let config = await StripeConfig.findOne({ isActive: true });

    // Create default config if none exists
    if (!config) {
      config = await StripeConfig.create({});
    }

    return res.status(200).json({
      success: true,
      data: config,
      message: "Stripe configuration fetched successfully",
    });
  } catch (error) {
    console.error("Error in getStripeConfig:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Stripe Configuration
export const updateStripeConfig = async (req, res) => {
  try {
    const {
      minOrderAmount,
      maxOrderAmount,
      refundWindowHours,
      allowPartialRefunds,
      autoRefundOnCancellation,
      useStripeCheckout,
      saveCardForFutureUse,
      allowGuestCheckout,
      defaultDeliveryFee,
      freeDeliveryThreshold,
    } = req.body;

    // Validation
    if (minOrderAmount !== undefined && minOrderAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Minimum order amount cannot be negative",
      });
    }

    if (maxOrderAmount !== undefined && maxOrderAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Maximum order amount cannot be negative",
      });
    }

    if (
      minOrderAmount !== undefined &&
      maxOrderAmount !== undefined &&
      minOrderAmount > maxOrderAmount
    ) {
      return res.status(400).json({
        success: false,
        message: "Minimum order amount cannot exceed maximum order amount",
      });
    }

    if (refundWindowHours !== undefined && refundWindowHours < 0) {
      return res.status(400).json({
        success: false,
        message: "Refund window hours cannot be negative",
      });
    }

    const updates = {};
    if (minOrderAmount !== undefined) updates.minOrderAmount = minOrderAmount;
    if (maxOrderAmount !== undefined) updates.maxOrderAmount = maxOrderAmount;
    if (refundWindowHours !== undefined)
      updates.refundWindowHours = refundWindowHours;
    if (typeof allowPartialRefunds === "boolean")
      updates.allowPartialRefunds = allowPartialRefunds;
    if (typeof autoRefundOnCancellation === "boolean")
      updates.autoRefundOnCancellation = autoRefundOnCancellation;
    if (typeof useStripeCheckout === "boolean")
      updates.useStripeCheckout = useStripeCheckout;
    if (typeof saveCardForFutureUse === "boolean")
      updates.saveCardForFutureUse = saveCardForFutureUse;
    if (typeof allowGuestCheckout === "boolean")
      updates.allowGuestCheckout = allowGuestCheckout;
    if (defaultDeliveryFee !== undefined)
      updates.defaultDeliveryFee = defaultDeliveryFee;
    if (freeDeliveryThreshold !== undefined)
      updates.freeDeliveryThreshold = freeDeliveryThreshold;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required for update",
      });
    }

    let config = await StripeConfig.findOne({ isActive: true });

    if (!config) {
      config = await StripeConfig.create(updates);
    } else {
      config = await StripeConfig.findByIdAndUpdate(config._id, updates, {
        new: true,
      });
    }

    return res.status(200).json({
      success: true,
      data: config,
      message: "Stripe configuration updated successfully",
    });
  } catch (error) {
    console.error("Error in updateStripeConfig:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== DELIVERY LOCATIONS ====================

// Create Delivery Location
export const createDeliveryLocation = async (req, res) => {
  try {
    const { governorate, city, deliveryFee, estimatedDeliveryTime, isActive } =
      req.body;

    if (!governorate || !city) {
      return res.status(400).json({
        success: false,
        message: "Governorate and city are required",
      });
    }

    if (deliveryFee === undefined || deliveryFee < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery fee is required (must be >= 0)",
      });
    }

    // Check if location already exists
    const existingLocation = await DeliveryLocation.findOne({
      governorate: governorate.trim(),
      city: city.trim(),
    });

    if (existingLocation) {
      return res.status(409).json({
        success: false,
        message: `Delivery location for ${city}, ${governorate} already exists`,
      });
    }

    const location = await DeliveryLocation.create({
      governorate: governorate.trim(),
      city: city.trim(),
      deliveryFee,
      estimatedDeliveryTime: estimatedDeliveryTime || "30-45 mins",
      isActive: isActive !== undefined ? isActive : true,
    });

    return res.status(201).json({
      success: true,
      data: location,
      message: "Delivery location created successfully",
    });
  } catch (error) {
    console.error("Error in createDeliveryLocation:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Delivery Locations
export const getAllDeliveryLocations = async (req, res) => {
  try {
    const { governorate, isActive } = req.query;

    const filter = {};
    if (governorate) filter.governorate = governorate;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const locations = await DeliveryLocation.find(filter).sort({
      governorate: 1,
      city: 1,
    });

    return res.status(200).json({
      success: true,
      data: locations,
      count: locations.length,
      message: "Delivery locations fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllDeliveryLocations:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Active Delivery Locations (for customers)
export const getActiveDeliveryLocations = async (req, res) => {
  try {
    const { governorate } = req.query;

    const filter = { isActive: true };
    if (governorate) filter.governorate = governorate;

    const locations = await DeliveryLocation.find(filter).sort({
      governorate: 1,
      city: 1,
    });

    return res.status(200).json({
      success: true,
      data: locations,
      count: locations.length,
      message: "Active delivery locations fetched successfully",
    });
  } catch (error) {
    console.error("Error in getActiveDeliveryLocations:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Governorates List
export const getGovernorates = async (req, res) => {
  try {
    const governorates = await DeliveryLocation.distinct("governorate", {
      isActive: true,
    });

    return res.status(200).json({
      success: true,
      data: governorates.sort(),
      count: governorates.length,
      message: "Governorates fetched successfully",
    });
  } catch (error) {
    console.error("Error in getGovernorates:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Cities by Governorate
export const getCitiesByGovernorate = async (req, res) => {
  try {
    const { governorate } = req.params;

    if (!governorate) {
      return res.status(400).json({
        success: false,
        message: "Governorate is required",
      });
    }

    const cities = await DeliveryLocation.find({
      governorate,
      isActive: true,
    }).select("city deliveryFee estimatedDeliveryTime");

    return res.status(200).json({
      success: true,
      data: cities,
      count: cities.length,
      message: `Cities in ${governorate} fetched successfully`,
    });
  } catch (error) {
    console.error("Error in getCitiesByGovernorate:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Delivery Fee by Location
export const getDeliveryFee = async (req, res) => {
  try {
    const { governorate, city } = req.query;

    if (!governorate || !city) {
      return res.status(400).json({
        success: false,
        message: "Governorate and city are required",
      });
    }

    const location = await DeliveryLocation.findOne({
      governorate,
      city,
      isActive: true,
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Delivery not available for this location",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        deliveryFee: location.deliveryFee,
        estimatedDeliveryTime: location.estimatedDeliveryTime,
      },
      message: "Delivery fee fetched successfully",
    });
  } catch (error) {
    console.error("Error in getDeliveryFee:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Delivery Location
export const updateDeliveryLocation = async (req, res) => {
  try {
    const { locationId } = req.params;
    const { governorate, city, deliveryFee, estimatedDeliveryTime, isActive } =
      req.body;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        message: "Location ID is required",
      });
    }

    const updates = {};
    if (governorate !== undefined) updates.governorate = governorate.trim();
    if (city !== undefined) updates.city = city.trim();
    if (deliveryFee !== undefined) {
      if (deliveryFee < 0) {
        return res.status(400).json({
          success: false,
          message: "Delivery fee cannot be negative",
        });
      }
      updates.deliveryFee = deliveryFee;
    }
    if (estimatedDeliveryTime !== undefined)
      updates.estimatedDeliveryTime = estimatedDeliveryTime;
    if (typeof isActive === "boolean") updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required for update",
      });
    }

    const location = await DeliveryLocation.findByIdAndUpdate(
      locationId,
      updates,
      { new: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Delivery location not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: location,
      message: "Delivery location updated successfully",
    });
  } catch (error) {
    console.error("Error in updateDeliveryLocation:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Delivery Location
export const deleteDeliveryLocation = async (req, res) => {
  try {
    const { locationId } = req.params;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        message: "Location ID is required",
      });
    }

    const location = await DeliveryLocation.findByIdAndDelete(locationId);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Delivery location not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery location deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteDeliveryLocation:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk Create Delivery Locations
export const bulkCreateDeliveryLocations = async (req, res) => {
  try {
    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Locations array is required",
      });
    }

    const createdLocations = [];
    const errors = [];

    for (const loc of locations) {
      try {
        const { governorate, city, deliveryFee, estimatedDeliveryTime } = loc;

        if (!governorate || !city || deliveryFee === undefined) {
          errors.push({
            location: loc,
            error: "Missing required fields (governorate, city, deliveryFee)",
          });
          continue;
        }

        const existing = await DeliveryLocation.findOne({
          governorate: governorate.trim(),
          city: city.trim(),
        });

        if (existing) {
          errors.push({
            location: loc,
            error: "Location already exists",
          });
          continue;
        }

        const location = await DeliveryLocation.create({
          governorate: governorate.trim(),
          city: city.trim(),
          deliveryFee,
          estimatedDeliveryTime: estimatedDeliveryTime || "30-45 mins",
        });

        createdLocations.push(location);
      } catch (err) {
        errors.push({
          location: loc,
          error: err.message,
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        created: createdLocations,
        createdCount: createdLocations.length,
        errors,
        errorCount: errors.length,
      },
      message: `Bulk creation completed: ${createdLocations.length} created, ${errors.length} failed`,
    });
  } catch (error) {
    console.error("Error in bulkCreateDeliveryLocations:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
