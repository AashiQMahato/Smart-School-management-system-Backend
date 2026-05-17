import express from "express";
import * as scheduleController from "../controllers/schedule.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Specific routes MUST come before parameterized routes like /:id

// Role-based UI-ready schedule endpoints
router.get("/admin", authorize("admin"), scheduleController.getAdminSchedules);

router.get(
  "/teacher",
  authorize("teacher"),
  scheduleController.getTeacherSchedulesForMe,
);

router.get(
  "/student",
  authorize("student"),
  scheduleController.getStudentSchedulesForMe,
);

router.get(
  "/parent",
  authorize("parent"),
  scheduleController.getParentSchedulesForMe,
);

// Teacher-specific route for authenticated teacher's own schedule
router.get(
  "/my-schedule",
  authorize("teacher"),
  scheduleController.getTeacherSchedule,
);

// Get weekly schedule for a class
router.get(
  "/class/:classId/section/:section",
  scheduleController.getWeeklyScheduleForClass,
);

// Get weekly schedule for a teacher
router.get(
  "/teacher/:teacherId",
  authorize(["admin", "teacher"]),
  scheduleController.getWeeklyScheduleForTeacher,
);

// Admin only routes
router.post("/", authorize("admin"), scheduleController.createSchedule);

router.put("/:id", authorize("admin"), scheduleController.updateSchedule);

router.delete("/:id", authorize("admin"), scheduleController.deleteSchedule);

// Routes accessible to all authenticated users
router.get("/", scheduleController.getSchedules);

// This MUST come last - it will match any /schedules/:id
router.get("/:id", scheduleController.getScheduleById);

export default router;
