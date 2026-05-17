/**
 * Calendar Routes
 * API endpoints for academic calendar management
 */

import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  createAcademicYear,
  getAllAcademicYears,
  getCurrentAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  togglePublish,
  getAnalytics,
  getStudentEvents,
  getParentEvents,
  getTeacherEvents,
  createTeacherEvent,
} from "../controllers/calendar.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ==================== ACADEMIC YEAR ROUTES ====================

// Admin only - CRUD for academic years
router.post("/academic-years", authorize(["admin"]), createAcademicYear);

router.get("/academic-years", getAllAcademicYears);

router.get("/academic-years/current", getCurrentAcademicYear);

router.put("/academic-years/:id", authorize(["admin"]), updateAcademicYear);

router.delete("/academic-years/:id", authorize(["admin"]), deleteAcademicYear);

// ==================== CALENDAR EVENT ROUTES ====================

// Admin - Full CRUD
router.post("/events", authorize(["admin"]), createEvent);

router.get("/events", getEvents);

router.get("/events/analytics", authorize(["admin"]), getAnalytics);

router.get("/events/:id", getEventById);

router.put("/events/:id", authorize(["admin"]), updateEvent);

router.delete("/events/:id", authorize(["admin"]), deleteEvent);

router.patch("/events/:id/toggle-publish", authorize(["admin"]), togglePublish);

// ==================== ROLE-SPECIFIC ROUTES ====================

// Teacher routes
router.get("/teacher/events", authorize(["teacher"]), getTeacherEvents);

router.post("/teacher/events", authorize(["teacher"]), createTeacherEvent);

// Student routes
router.get("/student/events", authorize(["student"]), getStudentEvents);

// Parent routes
router.get("/parent/events", authorize(["parent"]), getParentEvents);

export default router;
