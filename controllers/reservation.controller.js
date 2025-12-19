import Reservation from "../models/reservation.model.js";
import Table from "../models/table.model.js";
import {
  VALID_SLOTS,
  createLocalDate,
  getLocalDayRange,
  generateSlots,
  isValidSlot,
  validateSlotAndDate,
  getTodayDate,
} from "../helpers/reservation.helpers.js";

export const getAllSlotsForAllTables = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required.",
      });
    }

    const allTables = await Table.find();
    const { startOfDay, endOfDay } = getLocalDayRange(date);

    const currentReservations = await Reservation.find({
      reservationDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $in: ["Pending", "Confirmed"] },
    }).populate("table");

    const currentReservationsMap = {};

    currentReservations.forEach((r) => {
      const key = `${r.table.number}_${r.reservationDate.getTime()}`;
      currentReservationsMap[key] = "Reserved";
    });

    const result = [];

    allTables.forEach((table) => {
      const slots = generateSlots(date);
      const availableSlots = slots.filter(
        (slot) => !currentReservationsMap[`${table.number}_${slot.getTime()}`]
      );
      const reservedSlots = slots.filter(
        (slot) => currentReservationsMap[`${table.number}_${slot.getTime()}`]
      );

      result.push({
        tableNumber: table.number,
        capacity: table.capacity,
        isActive: table.isActive,
        reservedSlots,
        availableSlots,
      });
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: "slots fetched successfully!",
    });
  } catch (error) {
    console.log("Error in getAllSlotsForAllTables function", error);
    return res.status(500).json({
      success: false,
      message: "couldn't fetch slots",
    });
  }
};

export const createReservation = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const { tableNumber, date, slot } = req.body;

    if (!tableNumber || !date || !slot) {
      return res.status(400).json({
        success: false,
        message: "tableNumber, date, and slot are required.",
      });
    }

    // Validate slot and date
    const validation = validateSlotAndDate(slot, date);
    if (!validation.success) {
      return res.status(validation.statusCode).json({
        success: false,
        message: validation.message,
      });
    }

    const table = await Table.findOne({ number: tableNumber });
    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    const reservationDate = validation.reservationDate;

    const existing = await Reservation.findOne({
      table: table._id,
      reservationDate: reservationDate,
      status: { $in: ["Pending", "Confirmed"] },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This slot is already reserved for this table",
      });
    }

    const newReservation = await Reservation.create({
      user: userId,
      table: table._id,
      reservationDate,
      status: "Pending",
    });

    await newReservation.populate([
      { path: "user", select: "-refreshToken -password -__v" },
      { path: "table", select: "-__v -createdAt -updatedAt" },
    ]);

    return res.status(201).json({
      success: true,
      data: newReservation,
      message: "Reservation created successfully",
    });
  } catch (error) {
    console.error("Error in createReservation function", error);
    return res.status(500).json({
      success: false,
      message: "Couldn't create reservation",
    });
  }
};

export const updateReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const userId = req.user?._id;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: "Reservation id is required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User is not authenticated",
      });
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation doesn't exist",
      });
    }

    const { tableNumber, date, slot, status } = req.body;

    const updates = {};

    if (tableNumber) {
      const table = await Table.findOne({ number: tableNumber });
      if (!table) {
        return res.status(404).json({
          success: false,
          message: "Table not found",
        });
      }
      updates.table = table._id;
    }

    if (date && slot) {
      // Validate slot and date
      const validation = validateSlotAndDate(slot, date);
      if (!validation.success) {
        return res.status(validation.statusCode).json({
          success: false,
          message: validation.message,
        });
      }

      updates.reservationDate = validation.reservationDate;
    }

    if (status) {
      if (!["Pending", "Confirmed", "Cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Must be Pending, Confirmed, or Cancelled",
        });
      }
      updates.status = status;
    }

    if (updates.table || updates.reservationDate) {
      const conflictCheck = await Reservation.findOne({
        _id: { $ne: reservationId },
        table: updates.table || reservation.table,
        reservationDate: updates.reservationDate || reservation.reservationDate,
        status: { $in: ["Pending", "Confirmed"] },
      });

      if (conflictCheck) {
        return res.status(400).json({
          success: false,
          message: "This slot is already reserved for this table",
        });
      }
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      updates,
      { new: true }
    ).populate([
      { path: "user", select: "-refreshToken -password -__v" },
      { path: "table", select: "-__v -createdAt -updatedAt" },
    ]);

    return res.status(200).json({
      success: true,
      data: updatedReservation,
      message: "Reservation updated successfully",
    });
  } catch (error) {
    console.error("Error in updateReservation function", error);
    return res.status(500).json({
      success: false,
      message: "Couldn't update reservation",
    });
  }
};

export const getAllReservationsByDay = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required.",
      });
    }

    const { startOfDay, endOfDay } = getLocalDayRange(date);

    const reservations = await Reservation.find({
      reservationDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $in: ["Pending", "Confirmed"] },
    }).populate([
      { path: "user", select: "-refreshToken -password -__v" },
      { path: "table", select: "-__v -createdAt -updatedAt" },
    ]);

    if (!reservations || reservations.length === 0) {
      return res.status(200).json({
        success: true,
        data: reservations,
        message: "No reservations for this date!",
      });
    }

    return res.status(200).json({
      success: true,
      data: reservations,
      message: `Reservations for date:${date} fetched successfully!`,
    });
  } catch (error) {
    console.log("Error in getAllReservationsByDay function", error);
    return res.status(500).json({
      success: false,
      message: "couldn't fetch reservations",
    });
  }
};

export const getAllReservationsForTodayAllTables = async (req, res) => {
  try {
    const today = getTodayDate();
    const { startOfDay, endOfDay } = getLocalDayRange(today);

    const allTables = await Table.find();

    const reservations = await Reservation.find({
      reservationDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .select("-__v")
      .populate([{ path: "user", select: "-refreshToken -password -__v" }]);

    const tablesWithReservations = allTables.map((table) => {
      const tableReservations = reservations.filter(
        (reservation) =>
          reservation.table._id.toString() === table._id.toString()
      );

      return {
        tableId: table._id,
        tableNumber: table.number,
        capacity: table.capacity,
        isActive: table.isActive,
        reservations: tableReservations, // will be empty if no reservations
      };
    });

    return res.status(200).json({
      success: true,
      data: tablesWithReservations,
      message: "Reservations for today fetched successfully!",
    });
  } catch (error) {
    console.error("Error in getAllReservationsForTodayAllTables:", error);
    return res.status(500).json({
      success: false,
      message: "Couldn't fetch reservations",
    });
  }
};

export const getAllReservationsForCurrentUser = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User is not authenticated" });
    }

    const reservations = await Reservation.find({
      user: userId,
    }).populate([
      { path: "user", select: "-refreshToken -password -__v" },
      { path: "table", select: "-__v -createdAt -updatedAt" },
    ]);

    if (!reservations || reservations.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No reservations found for this user!",
      });
    }

    return res.status(200).json({
      success: true,
      data: reservations,
      message: `Reservations for user fetched successfully!`,
    });
  } catch (error) {
    console.log("Error in getAllReservationsForCurrentUser function", error);
    return res.status(500).json({
      success: false,
      message: "couldn't fetch reservations",
    });
  }
};

export const getAllReservationsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const reservations = await Reservation.find({
      user: userId,
    }).populate([
      { path: "user", select: "-refreshToken -password -__v" },
      { path: "table", select: "-__v -createdAt -updatedAt" },
    ]);

    if (!reservations || reservations.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No reservations found for this user!",
      });
    }

    return res.status(200).json({
      success: true,
      data: reservations,
      message: `Reservations for user fetched successfully!`,
    });
  } catch (error) {
    console.log("Error in getAllReservationsByUserId function", error);
    return res.status(500).json({
      success: false,
      message: "couldn't fetch reservations",
    });
  }
};

export const getAllReservationsByReservationId = async (req, res) => {
  try {
    const { reservationId } = req.params;
    if (!reservationId) {
      return res
        .status(400)
        .json({ success: false, message: "Reservation id is required" });
    }

    const reservation = await Reservation.findById(reservationId).populate([
      { path: "user", select: "-refreshToken -password -__v" },
      { path: "table", select: "-__v -createdAt -updatedAt" },
    ]);

    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: "Reservation doesn't exist!" });
    }

    return res.status(200).json({
      success: true,
      data: reservation,
      message: `Reservation fetched successfully!`,
    });
  } catch (error) {
    console.log("Error in getAllReservationsByReservationId function", error);
    return res.status(500).json({
      success: false,
      message: "couldn't fetch reservation",
    });
  }
};

export const deleteReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    if (!reservationId) {
      return res
        .status(400)
        .json({ success: false, message: "Reservation id is required" });
    }

    const deletedReservation = await Reservation.findByIdAndDelete(
      reservationId
    );
    if (!deletedReservation) {
      return res
        .status(404)
        .json({ success: false, message: "Reservation doesn't exist!" });
    }

    return res.status(200).json({
      success: true,
      message: `Reservation deleted successfully!`,
    });
  } catch (error) {
    console.log("Error in deleteReservation function", error);
    return res.status(500).json({
      success: false,
      message: "couldn't delete reservation",
    });
  }
};