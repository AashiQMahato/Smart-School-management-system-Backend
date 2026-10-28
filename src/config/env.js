/**
 * Environment configuration
 * Validates required variables once at startup and exposes typed values.
 */

const DEFAULT_CORS_ORIGINS = [
  "https://smart-school-management-system-frontend.onrender.com",
  "https://smart-school-management-system-frontend-sieb.onrender.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
];

const REQUIRED_VARS = ["MONGO_URI", "JWT_SECRET"];

const parseList = (value) =>
  String(value || "")
    .split(",")
    .map((v) => v.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const parseTrustProxy = (value) => {
  if (value === undefined || value === "") return 1;
  if (value === "true") return true;
  if (value === "false") return false;
  const asNumber = Number(value);
  return Number.isInteger(asNumber) ? asNumber : value;
};

export const validateEnv = () => {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}. See .env.example.`,
    );
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.warn(
      "JWT_SECRET is shorter than 32 characters. Use a long random value in production.",
    );
  }

  if (!process.env.GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is not set. AI endpoints will return errors.");
  }
};

const env = {
  get nodeEnv() {
    return process.env.NODE_ENV || "development";
  },
  get isProduction() {
    return this.nodeEnv === "production";
  },
  get port() {
    return Number(process.env.PORT) || 8080;
  },
  get mongoUri() {
    return process.env.MONGO_URI;
  },
  get jwtSecret() {
    return process.env.JWT_SECRET;
  },
  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || "1d";
  },
  get corsOrigins() {
    const fromEnv = parseList(process.env.CORS_ORIGINS);
    return fromEnv.length ? fromEnv : DEFAULT_CORS_ORIGINS;
  },
  get trustProxy() {
    return parseTrustProxy(process.env.TRUST_PROXY);
  },
};

export default env;
