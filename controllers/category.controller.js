import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import mongoose from "mongoose";
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: "Both fields are required",
      });
    }
    const isCategoryAvailable = await Category.findOne({ name: name });

    if (isCategoryAvailable) {
      return res.status(400).json({
        success: false,
        message: "Category with the given name already exists",
      });
    }

    const category = await Category.create({
      name: name,
      description: description,
    });

    return res.status(201).json({
      success: true,
      data: category,
      message: "Category created successfully",
    });
  } catch (error) {
    console.log("Error in createCategory function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    if (page < 1 || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive numbers",
      });
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    };
    const pipeline = [
      {
        $match: {},
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
    ];
    const allCategories = await Category.aggregatePaginate(pipeline, options);

    if (!allCategories.docs || allCategories.docs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No categories found",
      });
    }

    return res.status(200).json({
      success: true,
      data: allCategories.docs,
      currentPage: allCategories.page,
      totalPages: allCategories.totalPages,
      totalDocuments: allCategories.totalDocs,
      hasNextPage: allCategories.hasNextPage,
      hasPrevPage: allCategories.hasPrevPage,
      message: "All categories fetched successfully",
    });
  } catch (error) {
    console.log("Error in getAllCategories function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category id is required",
      });
    }

    const category = await Category.aggregate([
      {
        //we can use new instead of createFromHexString
        $match: {
          _id: mongoose.Types.ObjectId.createFromHexString(categoryId),
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
    ]);

    // Fix: Check array length instead of truthy check
    if (!category || category.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No category found with the given id",
      });
    }

    return res.status(200).json({
      success: true,
      data: category[0],
      message: "Category fetched successfully",
    });
  } catch (error) {
    console.log("Error in getCategoryById function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category id is required",
      });
    }

    const { name, description } = req.body;
    const changes = {};
    if (name) {
      changes.name = name;
    }
    if (description) {
      changes.description = description;
    }
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least 1 field is required to change",
      });
    }
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      changes,
      { new: true }
    );
    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: "Unable to update the category or category may not exist",
      });
    }
    return res.status(200).json({
      success: true,
      data: updatedCategory,
      message: "Category updated successfully",
    });
  } catch (error) {
    console.log("Error in updateCategory function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category id is required",
      });
    }

    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category may not exist",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.log("Error in deleteCategory function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

// ==================== CATEGORY DISCOUNT MANAGEMENT (ADMIN) ====================

/**
 * Set category discount (Admin)
 * PATCH /api/v2/category/:categoryId/discount
 */
export const setCategoryDiscount = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { discountPercentage, discountStartDate, discountEndDate, isDiscountActive } = req.body;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required",
      });
    }

    // Validate discount percentage
    if (discountPercentage !== undefined) {
      if (discountPercentage < 0 || discountPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: "Discount percentage must be between 0 and 100",
        });
      }
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Update discount fields
    if (discountPercentage !== undefined) category.discountPercentage = discountPercentage;
    if (discountStartDate !== undefined) category.discountStartDate = discountStartDate;
    if (discountEndDate !== undefined) category.discountEndDate = discountEndDate;
    category.isDiscountActive = isDiscountActive !== undefined ? isDiscountActive : true;

    await category.save();

    // Count affected products
    const productCount = await Product.countDocuments({ category: categoryId });

    return res.status(200).json({
      success: true,
      data: category,
      affectedProducts: productCount,
      message: "Category discount updated successfully",
    });
  } catch (error) {
    console.error("Error in setCategoryDiscount:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove category discount (Admin)
 * PATCH /api/v2/category/:categoryId/discount/remove
 */
export const removeCategoryDiscount = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required",
      });
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      {
        discountPercentage: 0,
        $unset: { discountStartDate: 1, discountEndDate: 1 },
        isDiscountActive: false,
      },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
      message: "Category discount removed successfully",
    });
  } catch (error) {
    console.error("Error in removeCategoryDiscount:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get category with active discount info (Public)
 * GET /api/v2/category/:categoryId/with-discount
 */
export const getCategoryWithDiscount = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const currentDiscount = category.getCurrentDiscount();

    return res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        activeDiscount: currentDiscount,
      },
      message: "Category fetched successfully",
    });
  } catch (error) {
    console.error("Error in getCategoryWithDiscount:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get all categories with discounts (Public)
 * GET /api/v2/category/with-discounts
 */
export const getCategoriesWithDiscounts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const now = new Date();

    // Find categories with active discounts
    const categories = await Category.find({
      isDiscountActive: true,
      discountPercentage: { $gt: 0 },
      $or: [
        { discountStartDate: { $exists: false } },
        { discountStartDate: { $lte: now } },
      ],
      $or: [
        { discountEndDate: { $exists: false } },
        { discountEndDate: { $gte: now } },
      ],
    })
      .skip(skip)
      .limit(limitNum)
      .sort({ discountPercentage: -1 }); // Highest discount first

    const total = await Category.countDocuments({
      isDiscountActive: true,
      discountPercentage: { $gt: 0 },
    });

    // Add product count for each category
    const categoriesWithInfo = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category._id,
          isAvailable: true,
        });
        
        return {
          ...category.toObject(),
          productCount,
          activeDiscount: category.getCurrentDiscount(),
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: categoriesWithInfo,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limitNum),
        total,
        hasNextPage: skip + categories.length < total,
        hasPrevPage: parseInt(page) > 1,
      },
      message: "Categories with discounts fetched successfully",
    });
  } catch (error) {
    console.error("Error in getCategoriesWithDiscounts:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};