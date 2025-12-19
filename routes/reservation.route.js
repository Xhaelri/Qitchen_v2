import express from "express";

import jwtVerify from "../middleware/auth.middleware.js";

import checkAdminRole from "../middleware/role.middleware.js";

import {
  createReservation,
  deleteReservation,
  getAllReservationsByDay,
  getAllReservationsByReservationId,
  getAllReservationsByUserId,
  getAllReservationsForCurrentUser,
  getAllReservationsForTodayAllTables,
  getAllSlotsForAllTables,
  updateReservation,
} from "../controllers/reservation.controller.js";

const router = express.Router();

router.use(jwtVerify);

router.get("/get-all-slots-for-all-tables/:date", getAllSlotsForAllTables);
router.get("/get-all-reservation-day/:date", getAllReservationsByDay);
router.get("/get-reservation-by-id/:reservationId", getAllReservationsByReservationId);
router.get("/get-all-reservation-for-user", getAllReservationsForCurrentUser);
router.get("/get-all-reservation-by-userId/:userId", getAllReservationsByUserId);
router.get("/get-all-reservation-for-today", getAllReservationsForTodayAllTables);

router.post("/create-reservation", createReservation);
router.patch("/update-reservation/:reservationId", updateReservation);
router.delete("/delete-reservation/:reservationId", checkAdminRole, deleteReservation);


export { router };

