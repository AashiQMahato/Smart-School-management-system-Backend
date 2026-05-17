import mongoose from "mongoose";

/**
 * Result Model (Marks)
 * Purpose: Stores academic performance per student per subject per exam.
 * Workflow: Teacher enters → submits → Admin approves → Admin publishes
 */
const resultSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      default: null,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student is required"],
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
      index: true,
    },
    examType: {
      type: String,
      enum: {
        values: [
          "unit-test-1",
          "unit-test-2",
          "midterm",
          "final",
          "assignment",
          "practical",
        ],
        message: "{VALUE} is not a valid exam type",
      },
      required: [true, "Exam type is required"],
    },
    examName: {
      type: String,
      trim: true,
      default: null,
    },
    marksObtained: {
      type: Number,
      required: [true, "Marks obtained is required"],
      min: [0, "Marks cannot be negative"],
    },
    maxMarks: {
      type: Number,
      required: [true, "Maximum marks is required"],
      min: [1, "Maximum marks must be at least 1"],
    },
    passingMarks: {
      type: Number,
      min: 0,
      default: 0,
    },
    grade: {
      type: String,
      enum: ["A+", "A", "B+", "B", "C+", "C", "D", "F", null],
      default: null,
    },
    gradePoint: {
      type: Number,
      min: 0,
      max: 4,
      default: null,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    isPassed: {
      type: Boolean,
      default: null,
    },
    status: {
      type: String,
      enum: ["Pass", "Fail", null],
      default: null,
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: null,
    },
    isSubmitted: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Grade point mapping
const gradePointMap = {
  "A+": 4.0,
  A: 3.6,
  "B+": 3.2,
  B: 2.8,
  "C+": 2.4,
  C: 2.0,
  D: 1.6,
  F: 0.0,
};

// Pre-save middleware to calculate percentage, grade, gradePoint, status
resultSchema.pre("save", function (next) {
  if (this.marksObtained !== undefined && this.maxMarks) {
    this.percentage = (this.marksObtained / this.maxMarks) * 100;

    if (this.percentage >= 90) this.grade = "A+";
    else if (this.percentage >= 80) this.grade = "A";
    else if (this.percentage >= 70) this.grade = "B+";
    else if (this.percentage >= 60) this.grade = "B";
    else if (this.percentage >= 50) this.grade = "C+";
    else if (this.percentage >= 40) this.grade = "C";
    else if (this.percentage >= 33) this.grade = "D";
    else this.grade = "F";

    this.gradePoint = gradePointMap[this.grade] ?? 0;

    const passing = this.passingMarks || 0;
    this.isPassed = this.marksObtained >= passing;
    this.status = this.isPassed ? "Pass" : "Fail";
  }
});

// Compound index for unique result per student per subject per exam
resultSchema.index(
  { studentId: 1, subjectId: 1, examType: 1, academicYear: 1, examId: 1 },
  { unique: true },
);

// Index for efficient querying
resultSchema.index({ classId: 1, examType: 1, academicYear: 1 });
resultSchema.index({ studentId: 1, academicYear: 1 });
resultSchema.index({ isPublished: 1 });
resultSchema.index({ isSubmitted: 1, isApproved: 1 });

const Result = mongoose.model("Result", resultSchema);

export default Result;
