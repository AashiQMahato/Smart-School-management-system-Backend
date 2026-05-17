import express from "express";
import {
  // Fee Structures
  createFeeStructure,
  getAllFeeStructures,
  updateFeeStructure,
  deleteFeeStructure,
  toggleFeeStructure,
  // Fee Assignment
  assignFeesToClass,
  // Fee CRUD
  createFee,
  createBulkFees,
  getAllFees,
  getFeesByStudent,
  getMyFees,
  // Payments
  recordPayment,
  parentPayment,
  getPaymentHistory,
  getAllPayments,
  // Update / Delete
  updateFee,
  deleteFee,
  // Analytics
  getFeeStats,
  getReceipt,
} from "../controllers/fee.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════

// Fee Structures
router.post("/structures", authorize(["admin"]), createFeeStructure);
router.get("/structures", authorize(["admin"]), getAllFeeStructures);
router.put("/structures/:id", authorize(["admin"]), updateFeeStructure);
router.delete("/structures/:id", authorize(["admin"]), deleteFeeStructure);
router.patch(
  "/structures/:id/toggle",
  authorize(["admin"]),
  toggleFeeStructure,
);

// Fee Assignment
router.post("/assign", authorize(["admin"]), assignFeesToClass);

// Fee CRUD (Admin)
router.post("/", authorize(["admin"]), createFee);
router.post("/bulk", authorize(["admin"]), createBulkFees);
router.get("/", authorize(["admin"]), getAllFees);

// Analytics (Admin)
router.get("/stats/summary", authorize(["admin"]), getFeeStats);

// Payments (Admin)
router.get("/payments/all", authorize(["admin"]), getAllPayments);
router.post("/:id/pay", authorize(["admin"]), recordPayment);

// Update / Delete Fee (Admin)
router.put("/:id", authorize(["admin"]), updateFee);
router.delete("/:id", authorize(["admin"]), deleteFee);

// ═══════════════════════════════════════
// STUDENT ROUTES
// ═══════════════════════════════════════

// Get my fees (Student)
router.get("/my", authorize(["student"]), getMyFees);

// ═══════════════════════════════════════
// PARENT ROUTES
// ═══════════════════════════════════════

// Parent payment
router.post("/:id/parent-pay", authorize(["parent"]), parentPayment);

// ═══════════════════════════════════════
// SHARED ROUTES (ADMIN + PARENT + STUDENT)
// ═══════════════════════════════════════

// Get fees by student (Admin, Student-own, Parent-children, Teacher-readonly)
router.get(
  "/student/:studentId",
  authorize(["admin", "parent", "student", "teacher"]),
  getFeesByStudent,
);

// Payment history
router.get(
  "/payments/:studentId",
  authorize(["admin", "parent", "student", "teacher"]),
  getPaymentHistory,
);

// Receipt
router.get("/receipt/:paymentId", authorize(["admin", "parent"]), getReceipt);

export default router;
