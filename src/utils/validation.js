import mongoose from "mongoose";

/**
 * Escape user input before using it inside a RegExp / $regex
 */
export const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Copy only the allowed keys that are present on `source`
 */
export const pick = (source, allowedKeys) => {
  const result = {};
  if (!source || typeof source !== "object") return result;
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  }
  return result;
};

/**
 * Parse page/limit query values with sane bounds
 */
export const parsePagination = (
  page,
  limit,
  { defaultLimit = 10, maxLimit = 100 } = {},
) => {
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(
    Math.max(parseInt(limit, 10) || defaultLimit, 1),
    maxLimit,
  );
  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
};

export const isValidObjectId = (value) =>
  typeof value === "string"
    ? mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value)
    : mongoose.isValidObjectId(value);

/**
 * Register ObjectId validation for the given route params on a router so that
 * malformed ids return 400 instead of bubbling up as CastError 500s.
 */
export const validateObjectIdParams = (router, paramNames) => {
  for (const name of paramNames) {
    router.param(name, (req, res, next, value) => {
      if (!isValidObjectId(value)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${name}`,
        });
      }
      next();
    });
  }
};
