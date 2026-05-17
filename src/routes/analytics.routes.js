/**
 * Analytics Routes
 * Each role gets its own endpoint; backend fetches data + calls Groq
 */

import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getAdminAnalytics,
  getTeacherAnalytics,
  getStudentAnalytics,
  getParentAnalytics,
} from "../controllers/analytics.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get("/admin", authorize(["admin"]), getAdminAnalytics);
router.get("/teacher", authorize(["teacher"]), getTeacherAnalytics);
router.get("/student", authorize(["student"]), getStudentAnalytics);
router.get("/parent", authorize(["parent"]), getParentAnalytics);

export default router;
