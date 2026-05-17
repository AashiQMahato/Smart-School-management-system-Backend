import express from "express";
import {
  markAttendance,
  updateAttendance,
  getStudentsForAttendance,
  getAttendanceByClassAndDate,
  getAttendanceByStudent,
  getMyAttendance,
  deleteAttendance,
  getAttendanceStats,
} from "../controllers/attendance.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// Mark attendance (Admin, Teacher)
router.post(
  "/mark",
  authenticate,
  authorize(["admin", "teacher"]),
  markAttendance,
);

// Update attendance (Admin, Teacher)
router.put(
  "/:id",
  authenticate,
  authorize(["admin", "teacher"]),
  updateAttendance,
);

// Delete attendance (Admin only)
router.delete("/:id", authenticate, authorize(["admin"]), deleteAttendance);

// Get attendance by class and date (Admin, Teacher)
router.get(
  "/class",
  authenticate,
  authorize(["admin", "teacher"]),
  getAttendanceByClassAndDate,
);

// Get students for attendance marking (Admin, Teacher)
router.get(
  "/students",
  authenticate,
  authorize(["admin", "teacher"]),
  getStudentsForAttendance,
);

// Get attendance statistics (Admin, Teacher)
router.get(
  "/stats",
  authenticate,
  authorize(["admin", "teacher"]),
  getAttendanceStats,
);

// Get my attendance (Student only)
router.get("/my", authenticate, authorize(["student"]), getMyAttendance);

// Get attendance for student (Admin, Teacher, Student-own, Parent-children)
router.get("/student", authenticate, getAttendanceByStudent);

export default router;
