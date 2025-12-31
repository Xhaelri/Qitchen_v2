// delivery.controller.js
// ✅ Delivery location management - Public + Admin endpoints

import DeliveryLocation from "../models/deliveryLocation.model.js";
import StripeConfig from "../models/stripeConfig.model.js";
import PaymobConfig from "../models/paymobConfig.model.js";

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get list of governorates where delivery is available
 * GET /api/v2/delivery/governorates
 */
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

/**
 * Get cities by governorate
 * GET /api/v2/delivery/governorates/:governorate/cities
 */
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

/**
 * Get delivery fee for a specific location
 * GET /api/v2/delivery/fee?governorate=X&city=Y
 */
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

    // Check free delivery threshold from configs
    const stripeConfig = await StripeConfig.findOne({ isActive: true });
    const paymobConfig = await PaymobConfig.findOne({ isActive: true });

    const freeDeliveryThreshold = Math.max(
      stripeConfig?.freeDeliveryThreshold || 0,
      paymobConfig?.freeDeliveryThreshold || 0
    );

    return res.status(200).json({
      success: true,
      data: {
        deliveryFee: location.deliveryFee,
        estimatedDeliveryTime: location.estimatedDeliveryTime,
        freeDeliveryThreshold: freeDeliveryThreshold > 0 ? freeDeliveryThreshold : null,
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

/**
 * Get all active delivery locations
 * GET /api/v2/delivery/locations
 */
export const getActiveDeliveryLocations = async (req, res) => {
  try {
    const locations = await DeliveryLocation.find({ isActive: true })
      .select("governorate city deliveryFee estimatedDeliveryTime")
      .sort({ governorate: 1, city: 1 });

    return res.status(200).json({
      success: true,
      data: locations,
      count: locations.length,
      message: "Delivery locations fetched successfully",
    });
  } catch (error) {
    console.error("Error in getActiveDeliveryLocations:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all delivery locations (including inactive)
 * GET /api/v2/delivery/all
 */
export const getAllDeliveryLocations = async (req, res) => {
  try {
    const locations = await DeliveryLocation.find().sort({
      governorate: 1,
      city: 1,
    });

    return res.status(200).json({
      success: true,
      data: locations,
      count: locations.length,
      message: "All delivery locations fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllDeliveryLocations:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create delivery location
 * POST /api/v2/delivery
 */
export const createDeliveryLocation = async (req, res) => {
  try {
    const { governorate, city, deliveryFee, estimatedDeliveryTime, isActive } = req.body;

    if (!governorate || !city || deliveryFee === undefined) {
      return res.status(400).json({
        success: false,
        message: "Governorate, city, and deliveryFee are required",
      });
    }

    if (deliveryFee < 0) {
      return res.status(400).json({
        success: false,
        message: "Delivery fee cannot be negative",
      });
    }

    const existing = await DeliveryLocation.findOne({
      governorate: governorate.trim(),
      city: city.trim(),
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Delivery location already exists",
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

/**
 * Update delivery location
 * PATCH /api/v2/delivery/:locationId
 */
export const updateDeliveryLocation = async (req, res) => {
  try {
    const { locationId } = req.params;
    const { governorate, city, deliveryFee, estimatedDeliveryTime, isActive } = req.body;

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
    if (estimatedDeliveryTime !== undefined) {
      updates.estimatedDeliveryTime = estimatedDeliveryTime;
    }
    if (isActive !== undefined) {
      updates.isActive = isActive === "true" || isActive === true;
    }

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

/**
 * Toggle delivery location active status
 * PATCH /api/v2/delivery/:locationId/toggle
 */
export const toggleDeliveryLocation = async (req, res) => {
  try {
    const { locationId } = req.params;
    const { isActive } = req.body;

    const location = await DeliveryLocation.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Delivery location not found",
      });
    }

    location.isActive = isActive !== undefined
      ? (isActive === "true" || isActive === true)
      : !location.isActive;

    await location.save();

    return res.status(200).json({
      success: true,
      data: {
        id: location._id,
        governorate: location.governorate,
        city: location.city,
        isActive: location.isActive,
      },
      message: `${location.city}, ${location.governorate} ${location.isActive ? "enabled" : "disabled"} successfully`,
    });
  } catch (error) {
    console.error("Error in toggleDeliveryLocation:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete delivery location
 * DELETE /api/v2/delivery/:locationId
 */
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
      message: `${location.city}, ${location.governorate} deleted successfully`,
    });
  } catch (error) {
    console.error("Error in deleteDeliveryLocation:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Bulk create delivery locations
 * POST /api/v2/delivery/bulk
 */
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

        if (deliveryFee < 0) {
          errors.push({
            location: loc,
            error: "Delivery fee cannot be negative",
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

export default {
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
};
