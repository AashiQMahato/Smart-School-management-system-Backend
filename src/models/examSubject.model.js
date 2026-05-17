import mongoose from "mongoose";

const examSubjectSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: [true, "Exam is required"],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
    },
    maxMarks: {
      type: Number,
      required: [true, "Maximum marks is required"],
      min: [1, "Maximum marks must be at least 1"],
    },
    passingMarks: {
      type: Number,
      required: [true, "Passing marks is required"],
      min: [0, "Passing marks cannot be negative"],
    },
    examDate: {
      type: Date,
      default: null,
    },
    marksEntryStatus: {
      type: String,
      enum: ["pending", "draft", "submitted", "approved", "rejected"],
      default: "pending",
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

examSubjectSchema.index(
  { examId: 1, subjectId: 1, classId: 1 },
  { unique: true },
);

const ExamSubject = mongoose.model("ExamSubject", examSubjectSchema);
export default ExamSubject;
