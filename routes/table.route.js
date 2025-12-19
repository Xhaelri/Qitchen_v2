import express from "express";

import jwtVerify from "../middleware/auth.middleware.js";

import checkAdminRole from "../middleware/role.middleware.js";

import {
  createTable,
  deleteTable,
  getAllTables,
  getTablebyId,
  updateTable,
} from "../controllers/table.controller.js";

const router = express.Router();

router.use(jwtVerify);

router.get("/get-table-by-id/:tableId", getTablebyId);

router.get("/get-all-tables", getAllTables);

router.post("/create-table", checkAdminRole, createTable);

router.patch("/update-table/:tableId", checkAdminRole, updateTable);

router.delete("/delete-table/:tableId", checkAdminRole, deleteTable);

export { router };
