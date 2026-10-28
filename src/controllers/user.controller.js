import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import Parent from "../models/parent.model.js";
import Teacher from "../models/teacher.model.js";
import Admin from "../models/admin.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../config/env.js";

// Used to keep login timing constant when the email does not exist
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("ssms-dummy-password", 10);

const MIN_PASSWORD_LENGTH = 6;

/**
 * User Controller
 * Handles user authentication (LOGIN ONLY)
 *
 * IMPORTANT: Signup has been removed.
 * All user creation is done by Admin through admin.controller.js
 */

/**
 * User Login
 * Authenticates user and fetches role-specific data
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      !email ||
      !password ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user (emails are stored lowercase)
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    // Verify password (compare against a dummy hash when the user is missing
    // so response timing does not reveal which emails exist)
    const isMatch = await bcrypt.compare(
      password,
      user?.password || DUMMY_PASSWORD_HASH,
    );
    if (!user || !isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role, profileId: user.profileId },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn, algorithm: "HS256" },
    );

    // Fetch role-specific profile using profileId from User model
    let roleProfile = null;

    if (user.profileId) {
      switch (user.role) {
        case "student":
          roleProfile = await Student.findById(user.profileId)
            .populate("userId", "name email phone status")
            .populate({
              path: "classId",
              select: "name section academicYear classTeacher roomNumber",
              populate: {
                path: "classTeacher",
                populate: { path: "userId", select: "name email phone" },
              },
            })
            .populate({
              path: "parentId",
              populate: { path: "userId", select: "name email phone" },
            });

          // Tolerate legacy data where classTeacher might mistakenly store a userId.
          try {
            const cls = roleProfile?.classId;
            const ct = cls?.classTeacher;
            const hasTeacherDetails =
              !!ct &&
              typeof ct === "object" &&
              (ct.userId?.name || ct.userId?.email || ct.userId?.phone);

            if (cls && ct && !hasTeacherDetails) {
              const resolvedTeacher =
                (await Teacher.findById(ct)
                  .populate("userId", "name email phone")
                  .lean()) ||
                (await Teacher.findOne({ userId: ct })
                  .populate("userId", "name email phone")
                  .lean());

              if (resolvedTeacher) {
                roleProfile.classId.classTeacher = resolvedTeacher;
              }
            }
          } catch {
            // Ignore; not critical for login
          }
          break;
        case "parent":
          roleProfile = await Parent.findById(user.profileId).populate({
            path: "children",
            populate: [
              { path: "userId", select: "name email phone" },
              { path: "classId", select: "name section" },
            ],
          });
          break;
        case "teacher":
          roleProfile = await Teacher.findById(user.profileId)
            .populate("assignedClasses", "name section")
            .populate("assignedSubjects", "name code");
          break;
        case "admin":
          roleProfile = await Admin.findById(user.profileId);
          break;
      }
    }

    res.json({
      success: true,
      token,
      user: user.toPublicJSON(),
      roleProfile,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Get users by role
 */
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;

    const query = {};
    if (role) {
      if (!["student", "parent", "teacher", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role specified",
        });
      }
      query.role = role;
    }

    const users = await User.find(query).select("_id name email role phone");

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

/**
 * Get current authenticated user with role profile
 */
export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = req.user;

    // Fetch role-specific profile using profileId
    let roleProfile = null;

    if (user.profileId) {
      switch (user.role) {
        case "student":
          roleProfile = await Student.findById(user.profileId)
            .populate("userId", "name email phone status")
            .populate({
              path: "classId",
              select: "name section academicYear classTeacher roomNumber",
              populate: {
                path: "classTeacher",
                populate: { path: "userId", select: "name email phone" },
              },
            })
            .populate({
              path: "parentId",
              populate: { path: "userId", select: "name email phone" },
            });

          // Tolerate legacy data where classTeacher might mistakenly store a userId.
          try {
            const cls = roleProfile?.classId;
            const ct = cls?.classTeacher;
            const hasTeacherDetails =
              !!ct &&
              typeof ct === "object" &&
              (ct.userId?.name || ct.userId?.email || ct.userId?.phone);

            if (cls && ct && !hasTeacherDetails) {
              const resolvedTeacher =
                (await Teacher.findById(ct)
                  .populate("userId", "name email phone")
                  .lean()) ||
                (await Teacher.findOne({ userId: ct })
                  .populate("userId", "name email phone")
                  .lean());

              if (resolvedTeacher) {
                roleProfile.classId.classTeacher = resolvedTeacher;
              }
            }
          } catch {
            // Ignore; fallback best-effort
          }
          break;
        case "parent":
          roleProfile = await Parent.findById(user.profileId).populate({
            path: "children",
            populate: [
              { path: "userId", select: "name email phone" },
              { path: "classId", select: "name section" },
            ],
          });
          break;
        case "teacher":
          roleProfile = await Teacher.findById(user.profileId)
            .populate("assignedClasses", "name section academicYear")
            .populate({
              path: "assignedSubjects",
              populate: { path: "classId", select: "name section" },
            });
          break;
        case "admin":
          roleProfile = await Admin.findById(user.profileId);
          break;
      }
    }

    return res.status(200).json({
      success: true,
      user: user.toPublicJSON
        ? user.toPublicJSON()
        : {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileId: user.profileId,
            profileModel: user.profileModel,
            phone: user.phone,
          },
      roleProfile,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get current user",
      error: error.message,
    });
  }
};

/**
 * Update current user's own contact details
 * Only non-privileged fields can be changed here (never role/email/profile).
 */
export const updateCurrentUser = async (req, res) => {
  try {
    const { phone } = req.body;

    if (phone !== undefined) {
      if (typeof phone !== "string" || !phone.trim()) {
        return res.status(400).json({
          success: false,
          message: "Phone must be a non-empty string",
        });
      }
      req.user.phone = phone.trim();
    }

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: req.user.toPublicJSON(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

/**
 * Change current user's password (requires the current password)
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: error.message,
    });
  }
};
