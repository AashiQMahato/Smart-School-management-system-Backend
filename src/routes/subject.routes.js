import express from "express";
import subjectController from "../controllers/subject.controller.js";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import { validateObjectIdParams } from "../utils/validation.js";

const router = express.Router();

// Malformed ids in the URL return 400 instead of a CastError 500
validateObjectIdParams(router, ["id"]);

// All routes require authentication
router.use(authenticate);

// Get all subjects - accessible by all authenticated users
router.get("/", subjectController.getAllSubjects);

// Get subject by ID - accessible by all authenticated users
router.get("/:id", subjectController.getSubjectById);

// Admin-only routes
router.post("/", authorizeRoles("admin"), subjectController.createSubject);
router.put("/:id", authorizeRoles("admin"), subjectController.updateSubject);
router.delete("/:id", authorizeRoles("admin"), subjectController.deleteSubject);

// Assign teacher to subject - admin only
router.post(
  "/:id/assign-teacher",
  authorizeRoles("admin"),
  subjectController.assignTeacher
);

export default router;
