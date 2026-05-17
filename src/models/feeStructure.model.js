import mongoose from "mongoose";

/**
 * Fee Structure Model
 * Defines reusable fee templates linked to classes and academic years.
 * Admin creates these, then assigns them to students.
 */
const feeStructureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Fee structure name is required"],
      trim: true,
    },
    feeType: {
      type: String,
      enum: {
        values: [
          "tuition",
          "exam",
          "transport",
          "fine",
          "library",
          "lab",
          "admission",
          "sports",
          "other",
        ],
        message: "{VALUE} is not a valid fee type",
      },
      required: [true, "Fee type is required"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: [true, "Fee amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    frequency: {
      type: String,
      enum: ["one-time", "monthly", "quarterly", "yearly"],
      default: "one-time",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

feeStructureSchema.index({ classId: 1, academicYear: 1 });
feeStructureSchema.index({ feeType: 1, isActive: 1 });

const FeeStructure = mongoose.model("FeeStructure", feeStructureSchema);

export default FeeStructure;
