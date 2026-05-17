import express from "express";
import assignmentController from "../controllers/assignment.controller.js";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============= TEACHER ROUTES =============
// Teacher: Create assignment
router.post(
  "/teacher/assignments",
  authorizeRoles("teacher"),
  assignmentController.createAssignment,
);

// Teacher: Get all assignments
router.get(
  "/teacher/assignments",
  authorizeRoles("teacher"),
  assignmentController.getTeacherAssignments,
);

// Teacher: Get assignment analytics
router.get(
  "/teacher/assignments/analytics",
  authorizeRoles("teacher"),
  assignmentController.getAssignmentAnalytics,
);

// Teacher: Get assignment by ID
router.get(
  "/teacher/assignments/:id",
  authorizeRoles("teacher"),
  assignmentController.getAssignmentById,
);

// Teacher: Update assignment
router.put(
  "/teacher/assignments/:id",
  authorizeRoles("teacher"),
  assignmentController.updateAssignment,
);

// Teacher: Delete assignment
router.delete(
  "/teacher/assignments/:id",
  authorizeRoles("teacher"),
  assignmentController.deleteAssignment,
);

// Teacher: Get submissions for an assignment
router.get(
  "/teacher/assignments/:id/submissions",
  authorizeRoles("teacher"),
  assignmentController.getAssignmentSubmissions,
);

// Teacher: Get non-submitters for an assignment
router.get(
  "/teacher/assignments/:id/non-submitters",
  authorizeRoles("teacher"),
  assignmentController.getNonSubmitters,
);

// Teacher: Grade a submission
router.put(
  "/teacher/submissions/:id/grade",
  authorizeRoles("teacher"),
  assignmentController.gradeSubmission,
);

// ============= STUDENT ROUTES =============
// Student: Get all assignments
router.get(
  "/student/assignments",
  authorizeRoles("student"),
  assignmentController.getStudentAssignments,
);

// Student: Get assignment by ID
router.get(
  "/student/assignments/:id",
  authorizeRoles("student"),
  assignmentController.getAssignmentById,
);

// Student: Submit assignment
router.post(
  "/student/assignments/:id/submit",
  authorizeRoles("student"),
  assignmentController.submitAssignment,
);

// Student: Get all my submissions
router.get(
  "/student/submissions",
  authorizeRoles("student"),
  assignmentController.getMySubmissions,
);

// Student: Get submission statistics
router.get(
  "/student/submissions/stats",
  authorizeRoles("student"),
  assignmentController.getSubmissionStats,
);

// Student: Get submission by ID
router.get(
  "/student/submissions/:id",
  authorizeRoles("student"),
  assignmentController.getSubmissionById,
);

// Student: Update submission (before grading)
router.put(
  "/student/submissions/:id",
  authorizeRoles("student"),
  assignmentController.updateSubmission,
);

// ============= ADMIN ROUTES =============
// Admin: Create assignment (on behalf of a teacher)
router.post(
  "/admin/assignments",
  authorizeRoles("admin"),
  assignmentController.adminCreateAssignment,
);

// Admin: Get all assignments
router.get(
  "/admin/assignments",
  authorizeRoles("admin"),
  assignmentController.getAdminAssignments,
);

// Admin: Get assignment by ID
router.get(
  "/admin/assignments/:id",
  authorizeRoles("admin"),
  assignmentController.adminGetAssignmentById,
);

// Admin: Update assignment
router.put(
  "/admin/assignments/:id",
  authorizeRoles("admin"),
  assignmentController.adminUpdateAssignment,
);

// Admin: Delete assignment
router.delete(
  "/admin/assignments/:id",
  authorizeRoles("admin"),
  assignmentController.adminDeleteAssignment,
);

// ============= SHARED/ADMIN ROUTES =============
// Get submission by ID (for admin/viewing)
router.get("/submissions/:id", assignmentController.getSubmissionById);

export default router;
