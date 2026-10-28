import multer from "multer";
import env from "../config/env.js";

/**
 * 404 handler for unmatched routes
 */
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Centralized error handler. Never leaks stack traces in production.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body is too large";
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path || "id"}`;
  } else if (err.name === "ValidationError") {
    status = 400;
  } else if (err.code === 11000) {
    status = 409;
    message = "Duplicate value";
  }

  if (status >= 500) {
    console.error(err);
    if (env.isProduction) message = "Internal server error";
  }

  const body = { success: false, message };
  if (!env.isProduction && status >= 500 && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
};
