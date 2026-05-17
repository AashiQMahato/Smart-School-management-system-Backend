import express from "express";
import classController from "../controllers/class.controller.js";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all classes - accessible by all authenticated users
router.get("/", classController.getAllClasses);

// Get class by ID - accessible by all authenticated users
router.get("/:id", classController.getClassById);

// Admin-only routes
router.post("/", authorizeRoles("admin"), classController.createClass);
router.put("/:id", authorizeRoles("admin"), classController.updateClass);
router.delete("/:id", authorizeRoles("admin"), classController.deleteClass);

// Assign/remove subjects - admin only
router.post(
  "/:id/subjects",
  authorizeRoles("admin"),
  classController.assignSubjects
);
router.delete(
  "/:id/subjects/:subjectId",
  authorizeRoles("admin"),
  classController.removeSubject
);

export default router;
