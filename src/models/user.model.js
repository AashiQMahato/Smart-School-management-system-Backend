import mongoose from "mongoose";

/**
 * User Model - Core Identity Model
 * Purpose: Stores authentication and common identity data for all users.
 * This model ONLY handles authentication. Role-specific data goes into
 * Student, Parent, Teacher, or Admin models.
 *
 * ADMIN-ONLY USER CREATION: Users are created exclusively by admins.
 * STATUS FIELD REMOVED: All users are active upon creation.
 */
const userSchema = new mongoose.Schema(
  {
    // Full Name - User's complete name
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    // Email Address - Login & communication (unique)
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Password - Encrypted password
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    // Role - Student / Parent / Teacher / Admin
    role: {
      type: String,
      enum: {
        values: ["student", "parent", "teacher", "admin"],
        message: "{VALUE} is not a valid role",
      },
      required: [true, "Role is required"],
    },
    // Profile ID - Reference to role-specific profile (Student/Teacher/Parent/Admin)
    // Establishes strict 1-to-1 relationship with role profile
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "profileModel",
      default: null,
    },
    // Profile Model - Determines which model profileId references
    profileModel: {
      type: String,
      enum: ["Student", "Teacher", "Parent", "Admin"],
      default: null,
    },
    // Mobile Number - Contact number
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    // Last Login - Last login timestamp
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// Indexes for faster queries
userSchema.index({ role: 1 });
userSchema.index({ email: 1 });
userSchema.index({ profileId: 1 });

// Virtual for user info without password
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    profileId: this.profileId,
    profileModel: this.profileModel,
    phone: this.phone,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model("User", userSchema);
export default User;
