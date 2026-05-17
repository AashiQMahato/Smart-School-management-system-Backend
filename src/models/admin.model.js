import mongoose from "mongoose";

/**
 * Admin Model
 * Purpose: Stores admin-specific privileges if needed.
 * Linked to User model via userId for identity/auth data.
 */
const adminSchema = new mongoose.Schema(
  {
    // User ID - Reference to User model (required)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    // Admin Level - Super / Normal
    adminLevel: {
      type: String,
      enum: {
        values: ["super", "normal"],
        message: "{VALUE} is not a valid admin level",
      },
      default: "normal",
    },
    // Department
    department: {
      type: String,
      trim: true,
      default: null,
    },
    // Permissions - Specific permissions for this admin
    permissions: {
      manageUsers: {
        type: Boolean,
        default: true,
      },
      manageClasses: {
        type: Boolean,
        default: true,
      },
      manageSubjects: {
        type: Boolean,
        default: true,
      },
      manageSchedules: {
        type: Boolean,
        default: true,
      },
      manageAttendance: {
        type: Boolean,
        default: true,
      },
      manageResults: {
        type: Boolean,
        default: true,
      },
      manageFees: {
        type: Boolean,
        default: true,
      },
      viewReports: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true, // Adds createdAt
  },
);

// Index for faster queries - userId must be unique
adminSchema.index({ userId: 1 }, { unique: true });

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
