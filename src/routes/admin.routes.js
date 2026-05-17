import express from "express";
import adminController from "../controllers/admin.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize(["admin"]));

// ============ USER MANAGEMENT ============
router.get("/users", adminController.getAllUsers);
router.post("/users", adminController.createUser);
router.get("/users/role/:role", adminController.getUsersByRole);
router.get("/users/:id", adminController.getUserById);
router.put("/users/:id", adminController.updateUser);
router.post("/users/:id/reset-password", adminController.resetUserPassword);
router.delete("/users/:id", adminController.deleteUser);

// ============ STUDENT MANAGEMENT ============
router.get("/students", adminController.getAllStudents);
router.post("/students", adminController.createStudentWithClassAssignment);
router.get("/students/class/:classId", adminController.getStudentsByClass);
router.get("/students/user/:userId", adminController.getStudentProfileByUserId);
router.put("/students/:id", adminController.updateStudent);
router.post("/students/assign-parent", adminController.assignParentToStudent);
router.post("/students/change-class", adminController.changeStudentClass);

// ============ PARENT MANAGEMENT ============
router.get("/parents", adminController.getAllParents);
router.get(
  "/parents/:parentId/children",
  adminController.getChildrenByParentId,
);
router.post("/parents/link-child", adminController.linkChildToParent);
router.post("/parents/unlink-child", adminController.unlinkChildFromParent);

// ============ TEACHER MANAGEMENT ============
router.get("/teachers", adminController.getAllTeachers);
router.get("/teachers/:teacherId", adminController.getTeacherById);
router.put("/teachers/:teacherId", adminController.updateTeacher);
router.get(
  "/teachers/:teacherId/assignments",
  adminController.getTeacherAssignments,
);

// ============ CLASS & SUBJECT ASSIGNMENTS ============
router.get("/classes/with-teachers", adminController.getAllClassesWithTeachers);
router.post("/classes/assign-teacher", adminController.assignClassTeacher);
router.post("/classes/remove-teacher", adminController.removeClassTeacher);
router.post("/subjects/assign-teacher", adminController.assignTeacherToSubject);

// ============ DASHBOARD DATA ============
router.get("/dashboard/stats", adminController.getDashboardStats);
router.get(
  "/dashboard/parent/:parentId",
  adminController.getParentDashboardData,
);
router.get(
  "/dashboard/student/:studentId",
  adminController.getStudentDashboardData,
);
router.get(
  "/dashboard/teacher/:teacherId",
  adminController.getTeacherDashboardData,
);

export default router;
