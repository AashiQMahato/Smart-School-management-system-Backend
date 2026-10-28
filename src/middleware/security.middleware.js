import { rateLimit, ipKeyGenerator } from "express-rate-limit";

/**
 * Remove MongoDB operator keys ("$..." and dotted paths) from user input.
 * Express 5 exposes req.query as a getter, so express-mongo-sanitize cannot
 * be used; the sanitized query is redefined on the request instead.
 */
const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

export const stripMongoOperators = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripMongoOperators);
  }
  if (isPlainObject(value)) {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      if (key === "__proto__" || key === "constructor" || key === "prototype")
        continue;
      clean[key] = stripMongoOperators(val);
    }
    return clean;
  }
  return value;
};

export const sanitizeRequest = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = stripMongoOperators(req.body);
  }

  const sanitizedQuery = stripMongoOperators(req.query);
  Object.defineProperty(req, "query", {
    value: sanitizedQuery,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  next();
};

const rateLimitHandler = (req, res, next, options) => {
  res.status(options.statusCode).json({
    success: false,
    message: options.message,
  });
};

const userOrIpKey = (req) =>
  req.user?._id ? `user:${req.user._id}` : ipKeyGenerator(req.ip);

/**
 * Login / credential endpoints: only failed attempts count.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please try again in 15 minutes.",
  handler: rateLimitHandler,
});

/**
 * AI-backed endpoints (Groq calls are slow and billed). Keyed per user;
 * mount after authenticate.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: "Too many AI requests. Please wait a minute and try again.",
  handler: rateLimitHandler,
});
