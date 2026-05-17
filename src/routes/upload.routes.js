import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { uploadFile, uploadSingle } from "../controllers/upload.controller.js";

const router = express.Router();

// Authenticated upload endpoint (used for assignment attachments and submissions)
router.post("/", authenticate, uploadSingle, uploadFile);

export default router;
