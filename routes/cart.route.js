import express from "express"
import { addProductToCart,getCartByUserId, deleteCart, getCart, removeProductInstanceFromCart, removeAllSameProductFromCart, clearCart, adjustProductQuantity, addMultipleProductsToCart } from "../controllers/cart.controller.js";
import jwtVerify from "../middleware/auth.middleware.js"

const router = express.Router()
router.use(jwtVerify);



router.get("/get-cart", getCart);

router.get("/get-cart/:userId", getCartByUserId);

router.patch("/remove-all-same-products/:productId", removeAllSameProductFromCart)

router.post("/add-product/:productId", addProductToCart)

router.post("/add-multiple-products", addMultipleProductsToCart)

router.patch("/adjust-quantity/:productId", adjustProductQuantity)

router.patch("/:productId", removeProductInstanceFromCart);

router.patch("/clear-cart", clearCart);

router.delete("/:productId", deleteCart);


export {
    router
}