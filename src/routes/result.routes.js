import express from "express";
import {
  createResult,
  createBulkResults,
  getResultsByClass,
  getResultsByStudent,
  getMyResults,
  updateResult,
  publishResults,
  deleteResult,
} from "../controllers/result.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// Protect all routes
router.use(authenticate);

// Create a result (Admin, Teacher)
router.post("/", authorize(["admin", "teacher"]), createResult);

// Create bulk results (Admin, Teacher)
router.post("/bulk", authorize(["admin", "teacher"]), createBulkResults);

// Get results by class (Admin, Teacher)
router.get(
  "/class/:classId",
  authorize(["admin", "teacher"]),
  getResultsByClass,
);

// Get my results (Student only)
router.get("/my", authorize(["student"]), getMyResults);

// Get results by student (Admin, Teacher, Student-own, Parent-children)
router.get("/student/:studentId", getResultsByStudent);

// Update a result (Admin, Teacher)
router.put("/:id", authorize(["admin", "teacher"]), updateResult);

// Publish results (Admin only)
router.post("/publish", authorize(["admin"]), publishResults);

// Delete a result (Admin only)
router.delete("/:id", authorize(["admin"]), deleteResult);

export default router;
