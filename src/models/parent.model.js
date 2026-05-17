import mongoose from "mongoose";

/**
 * Parent Model
 * Purpose: Links parents to one or more students.
 * Linked to User model via userId for identity/auth data.
 *
 * Relationships:
 * - One Parent → One User
 * - One Parent → One or More Students
 */
const parentSchema = new mongoose.Schema(
  {
    // User ID - Reference to User model (required)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    // Linked Students - List of Student IDs
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
    // Relationship Type - Father / Mother / Guardian
    relationshipType: {
      type: String,
      enum: {
        values: ["father", "mother", "guardian", "other"],
        message: "{VALUE} is not a valid relationship type",
      },
      default: "guardian",
    },
    // Emergency Contact - Emergency contact flag
    isEmergencyContact: {
      type: Boolean,
      default: true,
    },
    // Occupation
    occupation: {
      type: String,
      trim: true,
      default: null,
    },
    // Address
    address: {
      type: String,
      trim: true,
      default: null,
    },
    // Alternate Phone
    alternatePhone: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt
  },
);

// Index for faster queries - userId must be unique
parentSchema.index({ userId: 1 }, { unique: true });

const Parent = mongoose.model("Parent", parentSchema);

export default Parent;
