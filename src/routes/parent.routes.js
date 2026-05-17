import express from "express";
import parentController from "../controllers/parent.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// All parent routes require authentication
router.use(authenticate);
router.use(authorize(["parent"]));

router.get("/me", parentController.getMe);
router.get("/me/children", parentController.getMyChildren);

export default router;
