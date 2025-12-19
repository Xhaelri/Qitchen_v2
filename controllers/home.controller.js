import Category from "../models/category.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Reservation from "../models/reservation.model.js";
import Table from "../models/table.model.js";
import User from "../models/user.model.js";

// Helper function to create local date without timezone conversion
function createLocalDate(dateString, timeString = "00:00:00") {
  const [year, month, day] = dateString.split("-");
  const [hours, minutes, seconds = "00"] = timeString.split(":");
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

// Helper function to get start and end of day in local time
function getLocalDayRange(dateString) {
  const startOfDay = createLocalDate(dateString, "00:00:00");
  const endOfDay = createLocalDate(dateString, "23:59:59");
  endOfDay.setMilliseconds(999);
  return { startOfDay, endOfDay };
}

export const getHomeData = async (req, res) => {
  try {
    const activeOrdersCount = await Order.countDocuments({
      orderStatus: { $in: ["Processing", "Paid", "Ready", "On the way"] },
    });

    const now = new Date();
    const today =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");

    const { startOfDay, endOfDay } = getLocalDayRange(today);

    // Revenue & orders for today
    const revenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          paymentStatus: "Completed",
          orderStatus: { $nin: ["Failed", "Cancelled"] },
        },
      },
      {
        $group: {
          _id: null,
          todayTotalRevenue: { $sum: "$totalPrice" },
          todayOrderCount: { $sum: 1 },
        },
      },
    ]);

    // If no orders, default values
    let todayTotalRevenue = 0;
    let todayOrderCount = 0;
    if (revenueData.length) {
      todayTotalRevenue = revenueData[0].todayTotalRevenue;
      todayOrderCount = revenueData[0].todayOrderCount;
    }

    // Reservations for today
    const todayReservationCount = await Reservation.countDocuments({
      reservationDate: today,
    });

    const totalProductsCount = await Product.countDocuments();
    const totalCategoriesCount = await Category.countDocuments();
    const availableTablesCount = await Table.countDocuments({ isActive: true });
    const totalUsersCount = await User.countDocuments();

    const mostOrderdProducts = await Order.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalSold: { $sum: "$products.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          name: "$product.name",
          price: "$product.price",
          image: { $arrayElemAt: ["$product.images", 0] },
          totalSold: 1,
        },
      },
    ]);

    return res.json({
      success: true,
      data: {
        activeOrdersCount,
        todayTotalRevenue,
        todayOrderCount,
        todayReservationCount,
        totalProductsCount,
        totalCategoriesCount,
        availableTablesCount,
        totalUsersCount,
        mostOrderdProducts,
      },
    });
  } catch (error) {
    console.error("Error in getHomeData:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
