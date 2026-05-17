import mongoose from "mongoose";

/**
 * Student Model
 * Purpose: Stores academic and enrollment data for students.
 * Linked to User model via userId for identity/auth data.
 *
 * Relationships:
 * - One Student → One User
 * - One Student → Many Attendance records
 * - One Student → Many Marks records
 */
const studentSchema = new mongoose.Schema(
  {
    // User ID - Reference to User model (required)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    // Admission Number - School admission ID (unique)
    admissionNumber: {
      type: String,
      required: [true, "Admission number is required"],
      unique: true,
      trim: true,
    },
    // Roll Number - Class roll number
    rollNumber: {
      type: String,
      trim: true,
      default: null,
    },
    // Class - Current class reference
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },
    // Section - Section of class
    section: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    // Academic Year - Academic session
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
      default: () => {
        const year = new Date().getFullYear();
        return `${year}-${year + 1}`;
      },
    },
    // Date of Birth - Student DOB
    dateOfBirth: {
      type: Date,
      default: null,
    },
    // Enrollment Status - Active / Passed / Left
    enrollmentStatus: {
      type: String,
      enum: {
        values: ["active", "passed", "left", "transferred"],
        message: "{VALUE} is not a valid enrollment status",
      },
      default: "active",
    },
    // Parent ID - Reference to Parent model (optional)
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      default: null,
    },
    // Admission Date - Date of admission
    admissionDate: {
      type: Date,
      default: Date.now,
    },
    // Address
    address: {
      type: String,
      trim: true,
      default: null,
    },
    // Blood Group
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", null],
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt
  },
);

// Unique constraint: userId must be unique (one student profile per user)
studentSchema.index({ userId: 1 }, { unique: true });

// Unique constraint: rollNumber unique per class per academic year
studentSchema.index(
  { classId: 1, rollNumber: 1, academicYear: 1 },
  {
    unique: true,
    partialFilterExpression: {
      classId: { $exists: true, $ne: null },
      rollNumber: { $exists: true, $ne: null },
    },
  },
);

// Index for faster queries
studentSchema.index({ parentId: 1 });
studentSchema.index({ classId: 1, section: 1 });
studentSchema.index({ enrollmentStatus: 1 });
studentSchema.index({ academicYear: 1 });

const Student = mongoose.model("Student", studentSchema);

export default Student;
