import mongoose from "mongoose";

/**
 * Attendance Model
 * Purpose: Tracks student attendance.
 */
const attendanceSchema = new mongoose.Schema(
  {
    // Student ID - Student reference (references Student model)
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student is required"],
      index: true,
    },
    // Class - Class reference
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
      index: true,
    },
    // Subject ID - Subject reference
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
      index: true,
    },
    // Date - Attendance date
    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true,
    },
    // Status - Present / Absent / Late
    status: {
      type: String,
      enum: {
        values: ["present", "absent", "late", "excused"],
        message: "{VALUE} is not a valid attendance status",
      },
      required: [true, "Attendance status is required"],
    },
    // Remarks
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
      default: null,
    },
    // Marked By - Teacher ID (references Teacher model)
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Marked by teacher is required"],
    },
  },
  {
    timestamps: true, // Adds createdAt
  },
);

// Compound index to ensure one attendance record per student per subject per date
attendanceSchema.index(
  { studentId: 1, subjectId: 1, date: 1 },
  { unique: true },
);

// Index for efficient querying
attendanceSchema.index({ classId: 1, date: 1 });
attendanceSchema.index({ studentId: 1, date: 1 });
attendanceSchema.index({ markedBy: 1, date: 1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
