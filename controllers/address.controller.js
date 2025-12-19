import Address from "../models/address.model.js";
import User from "../models/user.model.js";

export const addAddress = async (req, res) => {
  try {
    const {
      governorate,
      city,
      street,
      buildingNumber,
      flatNumber,
      position = {},
    } = req.body;

    // Validate required fields
    if (
      [governorate, city, street].some(
        (field) => typeof field === "string" && field.trim() === ""
      ) ||
      buildingNumber === undefined ||
      flatNumber === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const address = await Address.create({
      owner: userId,
      governorate,
      city,
      street,
      buildingNumber,
      flatNumber,
      position,
    });
    
       await User.findByIdAndUpdate(
      userId,
      { $push: { addresses: address._id } },
      { new: true }
    );


    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: address,
    });
  } catch (error) {
    console.log("Error in addAddress function", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    if (!addressId) {
      return res
        .status(400)
        .json({ success: false, message: "Address id is required" });
    }

    const {
      governorate,
      city,
      street,
      buildingNumber,
      flatNumber,
      position = {},
    } = req.body;
    const allowedFields = {
      governorate,
      city,
      street,
      buildingNumber,
      flatNumber,
      position,
    };

    const changes = {};
    Object.keys(allowedFields).forEach((key) => {
      if (allowedFields[key] !== undefined) {
        changes[key] = allowedFields[key];
      }
    });
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least 1 field is required to be updated",
      });
    }

    const address = await Address.findByIdAndUpdate(addressId, changes, {
      new: true,
    });

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    return res.status(200).json({
      success: true,
      data: address,
      message: "Address updated successfully",
    });
  } catch (error) {
    console.log("Error in updateAddress function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getAddressById = async (req, res) => {
  try {
    const { addressId } = req.params;
    if (!addressId) {
      return res
        .status(400)
        .json({ success: false, message: "Address is required" });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found by the given id" });
    }

    return res.status(200).json({
      success: true,
      data: address,
      message: "Address fetched successfully",
    });
  } catch (error) {
    console.log("Error in getAddressById function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllAddressOfUser = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const getAllAddresses = await Address.find({ owner: userId });
    if (!getAllAddresses) {
      return res
        .status(404)
        .json({ success: false, message: "No address found" });
    }

    return res.status(200).json({
      success: true,
      data: getAllAddresses,
      message: "Addresses fetched successfully",
    });
  } catch (error) {
    console.log("Error in getAllAddressOfUser function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    if (!addressId) {
      return res
        .status(400)
        .json({ success: false, message: "Address is required" });
    }

    const address = await Address.findByIdAndDelete(addressId);
    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found by the given id" });
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.log("Error in deleteAddress function", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};
