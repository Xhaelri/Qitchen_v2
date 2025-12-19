import express from "express";
import jwtVerify from "../middleware/auth.middleware.js";
import { addAddress, deleteAddress, getAddressById, getAllAddressOfUser, updateAddress } from "../controllers/address.controller.js";
const router = express.Router();
router.use(jwtVerify);

router.get("/get-user-addresses",getAllAddressOfUser)

router.post("/add-address",addAddress)

router.get("/:addressId",getAddressById)

router.patch("/:addressId",updateAddress)

router.delete("/:addressId",deleteAddress)


export {router}