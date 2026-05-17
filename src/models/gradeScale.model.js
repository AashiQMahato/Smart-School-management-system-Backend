import mongoose from "mongoose";

const gradeScaleSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      required: [true, "Grade label is required"],
      trim: true,
    },
    minPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    maxPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    gradePoint: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

gradeScaleSchema.index({ minPercentage: 1, maxPercentage: 1 });

const GradeScale = mongoose.model("GradeScale", gradeScaleSchema);
export default GradeScale;
