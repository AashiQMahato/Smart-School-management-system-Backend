import mongoose from "mongoose";

/**
 * Subject Model
 * Purpose: Defines subjects offered in each class.
 */
const subjectSchema = new mongoose.Schema(
  {
    // Subject Name - Name of subject
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },
    // Subject Code - Subject reference code (unique)
    code: {
      type: String,
      required: [true, "Subject code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    // Assigned Teacher - Teacher reference (references Teacher model)
    assignedTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    // Class - Associated class
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },
    // Classes - Associated classes (multi-class support)
    classIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Class",
      default: [],
    },
    // Academic Year - Academic session
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },
    // Description
    description: {
      type: String,
      trim: true,
      default: null,
    },
    // Credits/Weightage
    credits: {
      type: Number,
      min: 0,
      default: 1,
    },
    // Is Active
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
subjectSchema.index({ classId: 1, academicYear: 1 });
subjectSchema.index({ classIds: 1, academicYear: 1 });
subjectSchema.index({ assignedTeacher: 1 });

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;
