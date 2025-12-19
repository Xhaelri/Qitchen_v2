import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import Review from "../models/review.model.js";
import {
  destroyFromCloudinary,
  destroyMultipleFromCloudinary,
  uploadMultipleOnCloudinary,
} from "../utils/cloudinary.js";
export const productListing = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, price, ingredients } = req.body;
    if (!categoryId) {
      res
        .status(400)
        .json({ success: false, message: "Category id is required" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category with the give id doesn't exist",
      });
    }
    if ([name, description, price].some((field) => field?.trim() === "")) {
      res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    let normalizedIngredients;
    if (ingredients) {
      try {
        normalizedIngredients = JSON.parse(ingredients);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid ingredients JSON format",
        });
      }
    }
    const adminId = req.user?._id;

    if (!adminId) {
      res
        .status(401)
        .json({ success: false, message: "Admin is not authenticated" });
    }

    // const productImagesPath = req.files.map((file) => file.path);

    // if (!productImagesPath || productImagesPath.length === 0) {
    //   res
    //     .status(400)
    //     .json({ success: false, message: "At least one image is required" });
    // }
    // const uploadedImagesUrl = [];
    // const imagesPublicIdFromCloudinary = [];

    // for (const file of productImagesPath) {
    //   const uploadProductImagesOnCloudinary = await uploadOnCloudinary(file);
    //   uploadedImagesUrl.push(uploadProductImagesOnCloudinary.url);
    //   imagesPublicIdFromCloudinary.push(
    //     uploadProductImagesOnCloudinary.public_id
    //   );
    // }

    // const listProduct = await Product.create({
    //   name: name,
    //   description: description,
    //   price: price,
    //   ingredients: normalizedIngredients,
    //   images: uploadedImagesUrl,
    //   imagesPublicId: imagesPublicIdFromCloudinary,
    //   category: categoryId,
    // });

    // const product = await Product.findById(listProduct._id)
    //   .populate("category")
    //   .select(" name description price isAvailable images category");
    // if (!product) {
    //   res
    //     .status(400)
    //     .json({ success: false, message: "Unable to list the product" });
    // }

    
    let uploadedImages = [];
    
    try {
      // Upload all images to Cloudinary directly from memory
      uploadedImages = await uploadMultipleOnCloudinary(req.files, "products");
      
      const uploadedImagesUrl = uploadedImages.map(img => img.secure_url);
      const imagesPublicIdFromCloudinary = uploadedImages.map(img => img.public_id);

      const listProduct = await Product.create({
        name: name,
        description: description,
        price: price,
        ingredients: normalizedIngredients,
        images: uploadedImagesUrl,
        imagesPublicId: imagesPublicIdFromCloudinary,
        category: categoryId,
      });

      const product = await Product.findById(listProduct._id)
        .populate("category")
        .select("name description price ingredients isAvailable images category");
        
      if (!product) {
        // If product creation failed, cleanup uploaded images
        await destroyMultipleFromCloudinary(imagesPublicIdFromCloudinary);
        return res
          .status(400)
          .json({ success: false, message: "Unable to list the product" });
      }

      return res
        .status(201)
        .json({ 
          success: true,
          data: product, 
          message: "Product listed successfully" 
        });
        
    } catch (uploadError) {
      console.error("Error uploading images:", uploadError);
      
      // Cleanup any uploaded images if there was an error
      if (uploadedImages.length > 0) {
        const publicIds = uploadedImages.map(img => img.public_id);
        await destroyMultipleFromCloudinary(publicIds);
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Error uploading images. Please try again." 
      });
    }
  } catch (error) {
    console.log("Error in productListing function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const toggleProductAvailability = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product id is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    product.isAvailable = !product.isAvailable;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product availability set to ${product.isAvailable}`,
      data: product,
    });
  } catch (error) {
    console.log("Error in toggleProductAvailability", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      res
        .status(404)
        .json({ success: false, message: "Product id is required" });
    }
    const product = await Product.findById(productId).select(
      "-imagesPublicId -review"
    );
    if (!product) {
      res
        .status(404)
        .json({ success: false, message: "Product doesn't exist" });
    }

    return res.status(200).json({
      success: true,
      data: product,
      message: "Product Fetched successfully",
    });
  } catch (error) {
    console.log("Error in getProductById function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const updateListedProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product id is required" });
    }

    const allowedFields = ["name", "description", "price", "ingredients"];
    const updateChanges = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateChanges[field] = req.body[field];
      }
    });
    if (Object.keys(updateChanges).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least 1 field is required" });
    }

    const updateProduct = await Product.findByIdAndUpdate(
      productId,
      updateChanges,
      {
        new: true,
      }
    )
      .populate("category")
      .select("name description price isAvailable ingredients images category");
    if (!updateProduct) {
      return res
        .status(400)
        .json({ success: false, message: "Unable to update the product" });
    }

    return res
      .status(200)
      .json({ data: updateProduct, message: "Product updated successfully" });
  } catch (error) {
    console.log("Error in updateListedProduct function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const changeProductCategory = async (req, res) => {
  try {
    const { categoryId, productId } = req.params;
    if (!categoryId || !productId) {
      return res.status(400).json({
        success: false,
        message: "Category id and product id both are required",
      });
    }

    const updateCategory = await Product.findByIdAndUpdate(
      productId,
      { category: categoryId },
      { new: true }
    )
      .populate("category")
      .select("name description price isAvailable ingredients images category");
    if (!updateCategory) {
      res
        .status(400)
        .json({ success: false, message: "Unable to update the category" });
    }

    return res.status(200).json({
      data: updateCategory,
      message: "Product category Updated Successfully",
    });
  } catch (error) {
    console.log("Error in changeProductCategory function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const addProductImages = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product Id is required" });
    }

    const product = await Product.findById(productId);
    // await destroyMultipleFromCloudinary(product.public_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product with the given id is not found",
      });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images provided. Please upload at least one image.",
      });
    }

    const images = req.files.map((file) => file.path);

    if (product.images.length + images.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Only 10 images are allowed for a single product",
      });
    }

    let uploadedImages = [];
     try {
      // Upload all images to Cloudinary directly from memory buffers
      uploadedImages = await uploadMultipleOnCloudinary(req.files, "products");
      
      const uploadedImagesUrl = uploadedImages.map(img => img.secure_url);
      const uploadedImagesPublicId = uploadedImages.map(img => img.public_id);

      // Update product with new images using $push to add to existing arrays
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        {
          $push: {
            images: { $each: uploadedImagesUrl },
            imagesPublicId: { $each: uploadedImagesPublicId },
          },
        },
        {
          new: true,
        }
      );

      if (!updatedProduct) {
        // If database update failed, cleanup uploaded images
        await destroyMultipleFromCloudinary(uploadedImagesPublicId);
        return res.status(400).json({
          success: false,
          message: "Unable to add images to database",
        });
      }

      return res.status(200).json({ 
        success: true,
        data: updatedProduct, 
        message: "Images added successfully" 
      });

    } catch (uploadError) {
      console.error("Error uploading images:", uploadError);
      
      // Cleanup any uploaded images if there was an error
      if (uploadedImages.length > 0) {
        const publicIds = uploadedImages.map(img => img.public_id);
        await destroyMultipleFromCloudinary(publicIds);
      }
      
      return res.status(500).json({
        success: false,
        message: "Error uploading images. Please try again.",
      });
    }

    // const uploadedImagesUrl = [];
    // const uploadedImagesPublicId = [];

    // for (const filePath of images) {
    //   const uploadFileImagesOnCloudinary = await uploadOnCloudinary(filePath);
    //   uploadedImagesUrl.push(uploadFileImagesOnCloudinary.url);
    //   uploadedImagesPublicId.push(uploadFileImagesOnCloudinary.public_id);
    // }
    // // Update product with new images:
    // // product.images = uploadedImagesUrl;
    // // product.imagesPublicId = uploadedImagesPublicId;
    // // await product.save();

    // // if we want to add images without deleting the old ones and remove the save
    // const updatedImages = await Product.findByIdAndUpdate(
    //   productId,
    //   {
    //     $push: {
    //       images: { $each: uploadedImagesUrl },
    //       imagesPublicId: { $each: uploadedImagesPublicId },
    //     },
    //   },
    //   {
    //     new: true,
    //   }
    // );
    // if (!updatedImages) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Unable to add images",
    //   });
    // }

    // // if we want to add images instead of the old ones entirely, return the product.save()

    // // const updatedImages = await Product.findById(productId);
    // // if (!updatedImages) {
    // //   return res.status(400).json({
    // //     success: false,
    // //     message: "Unable to update images",
    // //   });
    // // }

    return res
      .status(200)
      .json({ data: updatedImages, message: "Images added successfully" });
  } catch (error) {
    console.log("Error in addProductImages function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const deleteSingleImage = async (req, res) => {
  try {
    const { productId, publicId } = req.params; // Get publicId from params
    
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product Id is required" });
    }

    if (!publicId) {
      return res
        .status(400)
        .json({ success: false, message: "Image public ID is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product with the given id is not found",
      });
    }

    // Find the index of the publicId in the array
    const publicIdIndex = product.imagesPublicId.indexOf(publicId);
    
    if (publicIdIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Image with the given public ID not found in this product",
      });
    }

    // Delete from Cloudinary
    await destroyFromCloudinary(publicId);

    // Remove the image and publicId from arrays using $pull
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $pull: {
          images: product.images[publicIdIndex], // Remove the corresponding image URL
          imagesPublicId: publicId // Remove the publicId
        }
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(400).json({
        success: false,
        message: "Unable to delete image from database",
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedProduct,
      message: "Image deleted successfully"
    });
  } catch (error) {
    console.log("Error in deleteSingleImage function", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "product id is required",
      });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product with the given id is not found",
      });
    }
    
    try {
      // Delete all images from Cloudinary using the correct field name
      if (product.imagesPublicId && product.imagesPublicId.length > 0) {
        await destroyMultipleFromCloudinary(product.imagesPublicId);
      }

      // Delete all reviews associated with this product
      await Review.deleteMany({ productId });

      // Delete the product from database
      const deletedProduct = await Product.findByIdAndDelete(productId);
      if (!deletedProduct) {
        return res.status(400).json({
          success: false,
          message: "Product deletion failed or product not found",
        });
      }

      return res.status(200).json({ 
        success: true,
        message: "Product and associated data deleted successfully" 
      });

    } catch (deleteError) {
      console.error("Error during product deletion:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Error deleting product. Please try again.",
      });
    }
    // const product = await Product.findById(productId);
    // await destroyMultipleFromCloudinary(product.public_id);
    // await Review.deleteMany({ productId });

    // const deletedProduct = await Product.findByIdAndDelete(productId);
    // if (!deletedProduct) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "product is not deleted successfully or product not found",
    //   });
    // }

    // return res.status(200).json({ message: "Product deleted Successfully" });
  } catch (error) {
    console.log("Error in deleteProduct function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      name,
      category,
      minPrice,
      maxPrice,
      sortBy,
    } = req.query;

    if (page < 1 || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive numbers",
      });
    }

    const filter = {};

    if (name) filter.name = { $regex: name, $options: "i" };
    
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID format",
        });
      }
      //we can use new instead of createFromHexString
      filter.category = mongoose.Types.ObjectId.createFromHexString(category);
    }
    
    if (minPrice) {
      const min = Number(minPrice);
      if (isNaN(min)) {
        return res.status(400).json({
          success: false,
          message: "Invalid minPrice value",
        });
      }
      filter.price = { $gte: min };
    }
    
    if (maxPrice) {
      const max = Number(maxPrice);
      if (isNaN(max)) {
        return res.status(400).json({
          success: false,
          message: "Invalid maxPrice value",
        });
      }
      if (!filter.price) filter.price = {};
      filter.price = { ...filter.price, $lte: max };
    }

    // Fix: Initialize sort as empty object, not let
    let sort = {};

    if (sortBy) {
      const [field, order] = sortBy.split(":");
      if (
        ["name", "price"].includes(field) &&
        ["asc", "desc"].includes(order)
      ) {
        sort[field] = order === "desc" ? -1 : 1;
      } else if (field === "rating") {
        // Fix: Don't reassign sort, use array notation
        sort["averageRating"] = order === "desc" ? -1 : 1;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid sorting filter. Use format: field:order (e.g., name:asc, price:desc, rating:asc)",
        });
      }
    } else {
      sort.name = 1;
    }

    const pipeline = [
      {
        $match: filter,
      },
      {
        $lookup: {
          from: "reviews", 
          localField: "_id",
          foreignField: "productId",
          as: "reviews",
        },
      },
      {
        $addFields: {
          averageRating: {
            $ifNull: [{ $avg: "$reviews.rating" }, 0],
          },
        },
      },
      {
        $sort: sort,
      },
      {
        $project: {
          name: 1,
          description: 1,
          price: 1,
          ingredients: 1,
          isAvailable: 1,
          category: 1,
          images: 1,
          averageRating: 1,
        },
      },
    ];

    if (Product.aggregatePaginate) {
      const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      };

      const products = await Product.aggregatePaginate(pipeline, options);

      if (!products.docs || products.docs.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No products were found with the given filters",
        });
      }

      return res.status(200).json({
        success: true,
        data: products.docs,
        pagination: {
          currentPage: products.page,
          totalPages: products.totalPages,
          totalProducts: products.totalDocs,
          limit: products.limit,
          hasNextPage: products.hasNextPage,
          hasPrevPage: products.hasPrevPage,
        },
      });
    }
  } catch (error) {
    console.log("Error in getProducts function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const getReviewsForProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ productId })
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json(new ApiResponse(200, reviews, "Reviews fetched successfully"));
  } catch (error) {
    console.log("Error in getReviewsForProduct function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};
