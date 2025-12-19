import express from "express";
import  jwtVerify  from "../middleware/auth.middleware.js";
import { createReview, deleteReview, getReviewByReviewId, getReviewsByUserId, updateReview } from "../controllers/review.controller.js";

const router = express.Router();

router.use(jwtVerify);



router.post("/create-review/:productId",createReview)

router.get("/:productId/:reviewId", getReviewByReviewId)

router.patch("/:productId/:reviewId", updateReview)

router.delete("/:productId/:reviewId", deleteReview)

router.get("/user-reviews", getReviewsByUserId)

export {
    router
} 