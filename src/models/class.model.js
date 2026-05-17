import mongoose from "mongoose";

/**
 * Class Model
 * Purpose: Defines school classes and sections.
 */
const classSchema = new mongoose.Schema(
  {
    // Class Name - Grade name (e.g., "Class 10", "Grade 5")
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
    },
    // Section - Section identifier (e.g., "A", "B", "C")
    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
      uppercase: true,
    },
    // Academic Year - Academic session (e.g., "2025-2026")
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },
    // Class Teacher ID - Assigned teacher (references Teacher model)
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    // Subjects - List of subjects for this class
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    // Room Number - Default classroom
    roomNumber: {
      type: String,
      trim: true,
      default: null,
    },
    // Capacity - Maximum students allowed
    capacity: {
      type: Number,
      min: 1,
      default: 40,
    },
    // Is Active - Class status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Unique constraint for name + section + academicYear
classSchema.index({ name: 1, section: 1, academicYear: 1 }, { unique: true });

// Virtual for full class name
classSchema.virtual("fullName").get(function () {
  return `${this.name} - ${this.section}`;
});

// Ensure virtuals are included in JSON
classSchema.set("toJSON", { virtuals: true });
classSchema.set("toObject", { virtuals: true });

const Class = mongoose.model("Class", classSchema);

export default Class;
