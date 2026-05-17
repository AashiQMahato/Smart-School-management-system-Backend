/**
 * Calendar Event Model
 * Represents events in the academic calendar
 * Supports role-based visibility, class-specific events, and event categorization
 */

import mongoose from "mongoose";

const calendarEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      enum: {
        values: [
          "exam",
          "holiday",
          "school_event",
          "assignment_deadline",
          "fee_due",
          "announcement",
        ],
        message: "Invalid event type: {VALUE}",
      },
    },
    roleVisibility: [
      {
        type: String,
        enum: ["admin", "teacher", "student", "parent"],
      },
    ],
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    isAllDay: {
      type: Boolean,
      default: true,
    },
    color: {
      type: String,
      default: null,
    },
    // Reference to linked module entities
    linkedEntity: {
      entityType: {
        type: String,
        enum: ["exam", "assignment", "fee", null],
        default: null,
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Validate end date is after or equal to start date
calendarEventSchema.pre("validate", function (next) {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate("endDate", "End date must be on or after start date");
  }

});

// Indexes for efficient querying
calendarEventSchema.index({ startDate: 1, endDate: 1 });
calendarEventSchema.index({ eventType: 1 });
calendarEventSchema.index({ isPublished: 1 });
calendarEventSchema.index({ roleVisibility: 1 });
calendarEventSchema.index({ classId: 1 });
calendarEventSchema.index({ academicYear: 1 });
calendarEventSchema.index({ createdBy: 1 });

export default mongoose.model("CalendarEvent", calendarEventSchema);
