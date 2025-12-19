import User from "../models/user.model.js";

const checkAdminRole = async (req, res, next) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "User is not authenticated",
    });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User doesn't exist",
    });
  }
  const userRole = user.role?.toLowerCase();
  if (userRole === "admin" || userRole === "superadmin") {
    console.log("User is admin");
    next();
  } else {
    return res.status(400).json({
      success: false,
      message: "User is not authorized for this action",
    });
  }
};

export default checkAdminRole;
