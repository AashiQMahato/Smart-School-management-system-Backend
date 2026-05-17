/**
 * Academic Year Model
 * Represents an academic year period for the school
 */

import mongoose from "mongoose";

const academicYearSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Academic year name is required"],
      trim: true,
      unique: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure only one current academic year
academicYearSchema.pre("save", async function (next) {
  if (this.isCurrent) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isCurrent: false },
    );
  }

});

// Validate end date is after start date
academicYearSchema.pre("validate", function (next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    this.invalidate("endDate", "End date must be after start date");
  }

});

academicYearSchema.index({ isCurrent: 1 });
academicYearSchema.index({ startDate: 1, endDate: 1 });

export default mongoose.model("AcademicYear", academicYearSchema);
