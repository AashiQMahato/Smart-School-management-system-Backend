import express from "express";
import teacherController from "../controllers/teacher.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Teacher-only: current teacher's own assignments
router.get(
  "/me/assignments",
  authorize(["teacher"]),
  teacherController.getMyAssignments,
);

// Teacher-only: students by class (authorized)
router.get(
  "/class/:classId/students",
  authorize(["teacher"]),
  teacherController.getStudentsByClass,
);

export default router;
