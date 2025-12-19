import Reservation from "../models/reservation.model.js";
import Table from "../models/table.model.js";

// Valid time slots for reservations
export const VALID_SLOTS = ["16:00", "18:00", "20:00", "22:00"];

/**
 * Creates a local date without timezone conversion
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} timeString - Time in HH:MM:SS format (default: "00:00:00")
 * @returns {Date} Local date object
 */
export function createLocalDate(dateString, timeString = "00:00:00") {
  const [year, month, day] = dateString.split("-");
  const [hours, minutes, seconds = "00"] = timeString.split(":");
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Gets start and end of day in local time
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Object} Object with startOfDay and endOfDay
 */
export function getLocalDayRange(dateString) {
  const startOfDay = createLocalDate(dateString, "00:00:00");
  const endOfDay = createLocalDate(dateString, "23:59:59");
  endOfDay.setMilliseconds(999);
  return { startOfDay, endOfDay };
}

/**
 * Generates time slots for a given date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} interval - Interval in minutes (default: 120)
 * @returns {Date[]} Array of date objects representing time slots
 */
export function generateSlots(date, interval = 120) {
  const slots = [];
  let start = createLocalDate(date, "16:00:00");
  let end = createLocalDate(date, "24:00:00");

  let current = new Date(start);
  while (current < end) {
    slots.push(new Date(current));
    current = new Date(current.getTime() + interval * 60 * 1000);
  }
  return slots;
}

/**
 * Validates if a slot time is valid
 * @param {string} slot - Time slot in HH:MM format
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidSlot(slot) {
  return VALID_SLOTS.includes(slot);
}

/**
 * Creates a reservation date from date and slot strings
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} slot - Time slot in HH:MM format
 * @returns {Date} Reservation date object
 */
export function createReservationDate(date, slot) {
  const [year, month, day] = date.split("-");
  const [hours, minutes] = slot.split(":");
  return new Date(year, month - 1, day, hours, minutes, 0);
}

/**
 * Checks if a table is available at a specific time slot
 * @param {string} tableId - MongoDB ObjectId of the table
 * @param {Date} reservationDate - Date object for the reservation
 * @returns {Promise<boolean>} True if available, false if reserved
 */
export async function isTableAvailableAtSlot(tableId, reservationDate) {
  const conflictingReservation = await Reservation.findOne({
    table: tableId,
    reservationDate: reservationDate,
    status: { $in: ["Pending", "Confirmed"] },
  });

  return !conflictingReservation;
}

/**
 * Validates table exists and is active
 * @param {string} tableId - MongoDB ObjectId of the table
 * @returns {Promise<Object>} Object with success status and table/error message
 */
export async function validateTable(tableId) {
  const table = await Table.findById(tableId);
  
  if (!table) {
    return {
      success: false,
      message: "Table not found",
      statusCode: 404,
    };
  }
  
  if (!table.isActive) {
    return {
      success: false,
      message: "Selected table is not active",
      statusCode: 400,
    };
  }
  
  return {
    success: true,
    table,
  };
}

/**
 * Validates slot and checks if it's in the future
 * @param {string} slot - Time slot in HH:MM format
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Object with success status and reservationDate/error message
 */
export function validateSlotAndDate(slot, date) {
  // Validate slot format
  if (!isValidSlot(slot)) {
    return {
      success: false,
      message: `Invalid slot time. Available slots are: ${VALID_SLOTS.join(", ")}`,
      statusCode: 400,
    };
  }

  // Create reservation date
  const reservationDate = createReservationDate(date, slot);

  // Check if reservation time is in the future
  const now = new Date();
  if (reservationDate < now) {
    return {
      success: false,
      message: "Cannot create reservation for a past date and time",
      statusCode: 400,
    };
  }

  return {
    success: true,
    reservationDate,
  };
}

/**
 * Comprehensive validation for in-place orders
 * @param {string} tableId - MongoDB ObjectId of the table
 * @param {string} slot - Time slot in HH:MM format
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Object with success status and reservationDate/error details
 */
export async function validateInPlaceOrder(tableId, slot, date) {
  // Validate slot and date
  const slotValidation = validateSlotAndDate(slot, date);
  if (!slotValidation.success) {
    return slotValidation;
  }

  const { reservationDate } = slotValidation;

  // Check table availability at specific slot
  const tableAvailable = await isTableAvailableAtSlot(tableId, reservationDate);
  if (!tableAvailable) {
    return {
      success: false,
      message: "Selected table is not available at this time slot. Please choose another table or time slot.",
      statusCode: 400,
    };
  }

  // Validate table exists and is active
  const tableValidation = await validateTable(tableId);
  if (!tableValidation.success) {
    return tableValidation;
  }

  return {
    success: true,
    reservationDate,
    table: tableValidation.table,
  };
}

/**
 * Creates a reservation for an order
 * @param {string} userId - MongoDB ObjectId of the user
 * @param {string} tableId - MongoDB ObjectId of the table
 * @param {Date} reservationDate - Date object for the reservation
 * @param {string} orderId - MongoDB ObjectId of the order
 * @returns {Promise<Object>} Created reservation object
 */
export async function createReservationForOrder(userId, tableId, reservationDate, orderId) {
  const reservation = await Reservation.create({
    user: userId,
    table: tableId,
    reservationDate: reservationDate,
    status: "Confirmed",
    orderId: orderId,
  });

  return reservation;
}

/**
 * Gets today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
export function getTodayDate() {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}