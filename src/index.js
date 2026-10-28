import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import env, { validateEnv } from "./config/env.js";
import { sanitizeRequest } from "./middleware/security.middleware.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";
import userRoutes from "./routes/user.routes.js";
import scheduleRoutes from "./routes/schedule.routes.js";
import classRoutes from "./routes/class.routes.js";
import subjectRoutes from "./routes/subject.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import assignmentRoutes from "./routes/assignment.routes.js";
import resultRoutes from "./routes/result.routes.js";
import feeRoutes from "./routes/fee.routes.js";
import parentRoutes from "./routes/parent.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import examRoutes from "./routes/exam.routes.js";
import calendarRoutes from "./routes/calendar.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import aiRoutes from "./routes/ai.routes.js";

validateEnv();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Behind Render/other reverse proxies: needed for correct req.ip / req.protocol
app.set("trust proxy", env.trustProxy);
app.disable("x-powered-by");

// Security headers. Uploaded files are embedded by the frontend (another
// origin), so resources must be loadable cross-origin.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// CORS configuration (allowed origins come from CORS_ORIGINS)
const allowedOrigins = new Set(env.corsOrigins);
const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (no Origin header) and whitelisted origins
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(sanitizeRequest);

// Serve uploaded files (never as executable/active content)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), {
    dotfiles: "ignore",
    index: false,
    redirect: false,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    },
  }),
);

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

// Routes
app.use("/api/auth", userRoutes);
app.use("/api/users", userRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);

// 404 + centralized error handling (must be registered last)
app.use(notFound);
app.use(errorHandler);

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

// Connect to DB and start server
connectDB().then(() => {
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
});
