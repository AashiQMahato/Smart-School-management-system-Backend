import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
  addExamSubjects,
  getExamSubjects,
  updateExamSubject,
  enterMarks,
  submitMarks,
  getApprovalQueue,
  approveMarks,
  rejectMarks,
  publishExamResults,
  unpublishExamResults,
  getExamResults,
  getClassAnalytics,
  getMyExamResults,
  getChildExamResults,
  getReportCard,
  getTeacherExams,
  getAdminOverview,
  getStudentPublishedExams,
  getChildPublishedExams,
} from "../controllers/exam.controller.js";

const router = express.Router();

router.use(authenticate);

// ===== EXAM CRUD (Admin) =====
router.post("/", authorize(["admin"]), createExam);
router.get("/", authorize(["admin", "teacher"]), getAllExams);
router.get("/admin/overview", authorize(["admin"]), getAdminOverview);
router.get("/teacher/my-exams", authorize(["teacher"]), getTeacherExams);

// ===== STUDENT =====
router.get("/student/my-results", authorize(["student"]), getMyExamResults);
router.get(
  "/student/published-exams",
  authorize(["student"]),
  getStudentPublishedExams,
);

// ===== PARENT =====
router.get(
  "/parent/child/:studentId",
  authorize(["parent"]),
  getChildExamResults,
);
router.get(
  "/parent/child/:studentId/exams",
  authorize(["parent"]),
  getChildPublishedExams,
);

// ===== APPROVAL (Admin) =====
router.get("/approval/queue", authorize(["admin"]), getApprovalQueue);

// ===== REPORT CARD =====
router.get(
  "/report-card/:studentId",
  authorize(["admin", "teacher", "student", "parent"]),
  getReportCard,
);

// ===== EXAM by ID =====
router.get("/:id", authorize(["admin", "teacher"]), getExamById);
router.put("/:id", authorize(["admin"]), updateExam);
router.delete("/:id", authorize(["admin"]), deleteExam);

// ===== EXAM SUBJECTS =====
router.post("/:examId/subjects", authorize(["admin"]), addExamSubjects);
router.get(
  "/:examId/subjects",
  authorize(["admin", "teacher"]),
  getExamSubjects,
);
router.put("/subjects/:id", authorize(["admin"]), updateExamSubject);

// ===== MARKS ENTRY (Teacher, Admin) =====
router.post("/:examId/marks", authorize(["admin", "teacher"]), enterMarks);
router.post(
  "/marks/:examSubjectId/submit",
  authorize(["teacher"]),
  submitMarks,
);

// ===== APPROVAL ACTIONS (Admin) =====
router.post(
  "/marks/:examSubjectId/approve",
  authorize(["admin"]),
  approveMarks,
);
router.post("/marks/:examSubjectId/reject", authorize(["admin"]), rejectMarks);

// ===== PUBLISH (Admin) =====
router.post("/:examId/publish", authorize(["admin"]), publishExamResults);
router.post("/:examId/unpublish", authorize(["admin"]), unpublishExamResults);

// ===== RESULTS VIEW =====
router.get("/:examId/results", authorize(["admin", "teacher"]), getExamResults);
router.get(
  "/:examId/analytics/:classId",
  authorize(["admin", "teacher"]),
  getClassAnalytics,
);

export default router;
