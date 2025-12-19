import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { transporter } from "../configs/nodemailer.js";
import bcrypt from "bcrypt";
import {
  EMAIL_VERIFY_TEMPLATE,
  PASSWORD_RESET_TEMPLATE,
} from "../configs/emailTemplates.js";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found while generating tokens");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new Error("Unable to generate refresh and access token");
  }
};

export const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phoneNumber,
      role,
      isAccountVerified = false,
    } = req.body;

    // ✅ Validate all required fields
    if ([name, email, password, phoneNumber].some((field) => !field?.trim())) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // ✅ Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // ✅ Hash password

    // ✅ Create user (unverified at first)
    const user = new User({
      name,
      email,
      password,
      phoneNumber,
      role,
      isAccountVerified,
    });

    // ✅ Generate OTP and expiry
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000; // 24h expiry

    await user.save();

    // ✅ Send verification email
    const mailOptions = {
      from: process.env.STMP_EMAIL,
      to: email,
      subject: "Verify your Qitchen Account",
      html: EMAIL_VERIFY_TEMPLATE.replace("{{otp}}", otp).replace(
        "{{email}}",
        email
      ),
    };

    await transporter.sendMail(mailOptions);

    // ✅ Return created user without sensitive fields
    return res.status(201).json({
      success: true,
      message: "User registered successfully. Verification OTP sent to email.",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const isPassValid = await user.isPasswordCorrect(password);
    if (!isPassValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken -verifyOtp -resetOtp"
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        message: "User logged in successfully!",
        user: loggedInUser,
        accessToken: accessToken,
        refreshToken: refreshToken,
      });
  } catch (error) {
    console.log("Error in login function", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// Send Verification OTP to the User's Email
export const sendVerifyOtp = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);

    if (user.isAccountVerified) {
      return res.json({ success: false, message: "Account already verified" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;
    user.verifyOtpSendTime = Date.now()

    await user.save();

    const mailOptions = {
      from: process.env.STMP_EMAIL,
      to: user.email,
      subject: "Account Verification OTP",
      // text: `Your OTP is ${otp}. Verify your account using this OTP.`,
      html: EMAIL_VERIFY_TEMPLATE.replace("{{otp}}", otp).replace(
        "{{email}}",
        user.email
      ),
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Verification OTP sent to your email" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Verify the Email using the OTP
export const verifyEmail = async (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    return res.json({
      success: false,
      message: "Missing details",
    });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.verifyOtp === "" || user.verifyOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (user.verifyOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: "OTP Expired" });
    }

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;

    await user.save();

    return res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Check if user is authenticated
export const isAuthenticated = async (req, res) => {
  try {
    return res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Send Password Reset OTP
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({
      success: false,
      message: "Email is required",
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;
    user.resetOtpSendTime = Date.now()

    await user.save();

    const mailOptions = {
      from: process.env.STMP_EMAIL,
      to: user.email,
      subject: "Password Reset OTP",
      // text: `Your OTP for resetting your password is ${otp}. Use this OTP to proceed with resetting your password.`,
      html: PASSWORD_RESET_TEMPLATE.replace("{{otp}}", otp).replace(
        "{{email}}",
        user.email
      ),
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Reset User Password
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.json({
      success: false,
      message: "Email, OTP, and New Password are required",
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "User Not Found" });
    }

    if (user.resetOtp === "" || user.resetOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (user.resetOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: "OTP Expired" });
    }

    user.password = newPassword;
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;

    await user.save();

    return res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId)
      .select(
        "-password -refreshToken -verifyOtp -resetOtp"
      )
      .populate({
        path: "addresses",
        select: "-__v", // include all fields except __v
      });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.log("Error in Auth function", error);
    return res.status(404).json({ success: false, message: "User not found" });
  }
};

// Logout User : /api/user/logout

export const logoutUser = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(400).json({ message: "User is not authenticated" });
    }

    await User.findByIdAndUpdate(
      userId,
      {
        $unset: {
          refreshToken: 1,
        },
      },
      { new: true }
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({
        success: true,
        message: "User logged out successfully!",
      });
  } catch (error) {
    console.log("Error in logout function", error);
    return res
      .status(404)
      .json({ success: false, message: "Error logging out user" });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies.refreshToken;
    if (!incomingRefreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token is not recieved!" });
    }
    const decode = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET_KEY
    );
    if (!decode) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Refresh token" });
    }
    const user = await User.findById(decode?._id).select(
      " -phoneNumber -password -verifyOtp -resetOtp"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User doesn't exist or invalid refresh token",
      });
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is expired or Invalid",
      });
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        message: "Access token is refreshed",
        user,
        accessToken,
        refreshToken,
      });
  } catch (error) {
    console.log("Error in refrechAcessToken function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || !oldPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Old and new password is required" });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User is not authenticated" });
    }

    const user = await User.findById(userId);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
      return res
        .status(400)
        .json({ success: false, message: "Password is invalid" });
    }

    user.password = newPassword;
    await user.save({
      validateBeforeSave: false,
    });
    return res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.log("Error in updatePassword function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const updateAccountDetails = async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;
    const changes = {};
    if (name) {
      changes.name = name;
    }
    if (phoneNumber) {
      changes.phoneNumber = phoneNumber;
    }

    if (!name && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "At least 1 field is required for the update",
      });
    }
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User is not authenticated" });
    }
    const updatedUser = await User.findByIdAndUpdate(userId, changes, {
      new: true,
    }).select(" -password -verifyOtp -resetOtp");
    if (!updatedUser) {
      return res
        .status(400)
        .json({ success: false, message: "unable to update the details" });
    }
    return res.status(200).json({
      success: true,
      data: updatedUser,
      message: "Details updated successfully",
    });
  } catch (error) {
    console.log("Error in updateAccountDetails function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User id is required" });
    }
    const updateRole = await User.findByIdAndUpdate(
      userId,
      {
        role: "Admin",
      },
      { new: true }
    );

    if (!updateRole) {
      return res
        .status(404)
        .json({ success: false, message: "User with the given id not found" });
    }
    return res.status(200).json({
      success: true,
      data: updateRole,
      message: "User role updated successfully",
    });
  } catch (error) {
    console.log("Error in updateAccountDetails function", error);
    return res.status(404).json({ success: false, message: error.message });
  }
};
