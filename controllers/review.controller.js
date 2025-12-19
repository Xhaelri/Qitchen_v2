import Product from "../models/product.model.js";
import Review from "../models/review.model.js";

export const createReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const { productId } = req.params;
    const userId = req.user?._id;

    if (!rating && !comment) {
      return res.status(400).json({
        success: false,
        message: "Comment and rating both are required",
      });
    }

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product id is required" });
    }

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }
    const existingReview = await Review.findOne({
      owner: userId,
      product: productId,
    });
    if (existingReview) {
      return res
        .status(400)
        .json({ success: false, message: "You already reviewed this product" });
    }
    const product = await Product.findById(productId);

    if (!product) {
      return res
        .status(400)
        .json({ success: false, message: "Product not found" });
    }

    const review = await Review.create({
      productId,
      owner: userId,
      rating,
      comment,
    });

    return res.status(201).json({
      success: true,
      data: { review, product },
      message: "Review created successfully",
    });
  } catch (error) {
    console.log("Error in createReview function", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const { reviewId } = req.params;

    if (!rating && !comment) {
      return res
        .status(400)
        .json({ success: false, message: "Comment or rating is required" });
    }

    if (!reviewId) {
      return res
        .status(400)
        .json({ success: false, message: "Review id is required" });
    }

    const changes = {};
    if (rating) changes.rating = rating;
    if (comment) changes.comment = comment;

    const review = await Review.findByIdAndUpdate(reviewId, changes, {
      new: true,
    });
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    return res.status(200).json({
      success: true,
      data: review,
      message: "Review updated successfully",
    });
  } catch (error) {
    console.log("Error in updateReview function", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReviewByReviewId = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!reviewId) {
      return res
        .status(400)
        .json({ success: false, message: "Review id is required" });
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review for the given id doesn't exist",
      });
    }

    return res.status(200).json({
      success: true,
      data: review,
      message: "Review fetched successfully",
    });
  } catch (error) {
    console.log("Error in getReviewByReviewId function", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReviewsByUserId = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const review = await Review.find({
      owner: userId,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review for the given id doesn't exist",
      });
    }

    return res.status(200).json({
      success: true,
      data: review,
      message: "Review fetched successfully",
    });
  } catch (error) {
    console.log("Error in getReviewByUserId function", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!reviewId) {
      return res
        .status(400)
        .json({ success: false, message: "Review id is required" });
    }

    const review = await Review.findByIdAndDelete(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review for the given id doesn't exist",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.log("Error in deleteReview function", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


