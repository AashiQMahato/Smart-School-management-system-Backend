import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  chatWithAssistant,
  getChatContextPreview,
} from "../controllers/ai.controller.js";

const router = express.Router();

// All AI routes require authentication (Groq key stays backend-only)
router.use(authenticate);

// Chatbot: conversational assistant for dashboards
router.post("/chat", chatWithAssistant);

// Optional: quick way to debug what context the assistant sees (no secrets)
router.get("/context-preview", getChatContextPreview);

export default router;
