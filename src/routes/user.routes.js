import express from "express";
import {
  login,
  getUsersByRole,
  getCurrentUser,
  updateCurrentUser,
  changePassword,
} from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/security.middleware.js";

const router = express.Router();

// Authentication routes (LOGIN ONLY - signup removed)
router.post("/login", authLimiter, login);

router.post("/logout", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Get current authenticated user
router.get("/me", authenticate, getCurrentUser);

// Update current user's own contact details
router.put("/me", authenticate, updateCurrentUser);

// Change current user's password
router.put("/me/password", authenticate, authLimiter, changePassword);

// Get users by role (e.g., teachers for dropdown) - admin only
router.get("/", authenticate, authorize(["admin"]), getUsersByRole);

export default router;
