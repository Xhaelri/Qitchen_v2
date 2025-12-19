import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const jwtVerify = async (req, res, next) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ success: false, message: "Not Authorized" });
  }
  try {
    const decode = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY);
    if (!decode) {
      console.log("unable to decode the user information from the secret key!");
      return res.status(401).json({ success: false, message: "Invalid Token" });
    }

    const user = await User.findById(decode?._id).select(
      "-password -phoneNumber"
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User doesn't exist" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.log("Error in Auth Middleware", error);
    return res
      .status(401)
      .json({ success: false, message: "Token verification failed" });
  }
};

export default jwtVerify;
