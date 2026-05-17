import mongoose from "mongoose";

/**
 * Teacher Model
 * Purpose: Stores professional and teaching assignment details.
 * Linked to User model via userId for identity/auth data.
 *
 * Relationships:
 * - One Teacher → One User
 * - One Teacher → Many Schedule entries
 */
const teacherSchema = new mongoose.Schema(
  {
    // User ID - Reference to User model (required)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    // Employee Code - Internal staff ID (unique)
    employeeCode: {
      type: String,
      required: [true, "Employee code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    // Assigned Subjects - List of subjects
    assignedSubjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    // Assigned Classes - List of classes/sections
    assignedClasses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    // Qualification - Academic qualification
    qualification: {
      type: String,
      trim: true,
      default: null,
    },
    // Specialization - Subject specialization
    specialization: {
      type: String,
      trim: true,
      default: null,
    },
    // Joining Date - Date of joining
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    // Employment Status - Active / On Leave / Resigned / Terminated
    employmentStatus: {
      type: String,
      enum: {
        values: ["active", "on-leave", "resigned", "terminated"],
        message: "{VALUE} is not a valid employment status",
      },
      default: "active",
    },
    // Experience (in years)
    experience: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Address
    address: {
      type: String,
      trim: true,
      default: null,
    },
    // Emergency Contact
    emergencyContact: {
      name: {
        type: String,
        trim: true,
        default: null,
      },
      phone: {
        type: String,
        trim: true,
        default: null,
      },
      relationship: {
        type: String,
        trim: true,
        default: null,
      },
    },
  },
  {
    timestamps: true, // Adds createdAt
  },
);

// Index for faster queries - userId must be unique
teacherSchema.index({ userId: 1 }, { unique: true });
teacherSchema.index({ employmentStatus: 1 });
teacherSchema.index({ assignedClasses: 1 });
teacherSchema.index({ assignedSubjects: 1 });

const Teacher = mongoose.model("Teacher", teacherSchema);

export default Teacher;
