import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import "dotenv/config";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^[A-Za-z _-]{8,}$/.test(v);
        },
        message:
          "Username must be at least 8 characters long and can only contain letters, spaces, underscores (_), and hyphens (-).",
      },
    },
        addresses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Address",
      },
    ],
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address.",
      },
    },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^(010|011|012|015)\d{8}$/.test(v);
        },
        message:
          "Phone number must start with 010, 011, 012, or 015 and be exactly 11 digits long.",
      },
    },
    role: {
      type: String,
      default: "User",
      enum: ["User", "Admin", "SuperAdmin"],
    },
    refreshToken: {
      type: String,
    },
    verifyOtp: { type: String, default: "" },
    verifyOtpExpireAt: { type: Number, default: 0 },
    verifyOtpSendTime: { type: Number, default: 0 },
    isAccountVerified: { type: Boolean, default: false },
    resetOtp: { type: String, default: "" },
    resetOtpExpireAt: { type: Number, default: 0 },
    resetOtpSendTime: { type: Number, default: 0 },
  },
  { minimize: false }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // Validate password BEFORE hashing
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
  if (!passwordRegex.test(this.password)) {
    const error = new Error(
      "Password must be 8-16 characters long, include at least one uppercase letter, one lowercase letter, one number, one special character, and contain no spaces."
    );
    return next(error);
  }

  // Hash password after validation passes
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      name: this.name,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET_KEY,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET_KEY,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

const User = mongoose.model("User", userSchema);

export default User;
