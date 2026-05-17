import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import Parent from "../models/parent.model.js";
import Teacher from "../models/teacher.model.js";
import Admin from "../models/admin.model.js";
import Class from "../models/class.model.js";
import Subject from "../models/subject.model.js";
import { resolveTeacherProfile } from "../utils/profileHelper.js";
import Schedule from "../models/schedule.model.js";
import Attendance from "../models/attendance.model.js";
import Result from "../models/result.model.js";
import Fee from "../models/fee.model.js";
import bcrypt from "bcryptjs";

/**
 * Admin Controller
 * Handles all admin-only management operations
 * Following the reference-based design pattern:
 * - User model = identity & login
 * - Student/Parent/Teacher models = role-specific data
 */

/**
 * Generate unique admission number for students
 */
const generateAdmissionNumber = async () => {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await Student.countDocuments();
  return `ADM${year}${(count + 1).toString().padStart(5, "0")}`;
};

/**
 * Generate unique employee code for teachers
 */
const generateEmployeeCode = async () => {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await Teacher.countDocuments();
  return `EMP${year}${(count + 1).toString().padStart(4, "0")}`;
};

class AdminController {
  // ============ USER MANAGEMENT ============

  /**
   * Create a new user with role-specific profile
   * ADMIN ONLY: This is the only way to create users in the system
   * Automatically creates corresponding role profile and establishes 1-to-1 relationship
   */
  async createUser(req, res) {
    try {
      const { name, email, password, role, phone, ...roleData } = req.body;

      // Validate required fields
      if (!name || !email || !password || !role || !phone) {
        return res.status(400).json({
          success: false,
          message: "Required fields: name, email, password, role, phone",
        });
      }

      // Validate role
      if (!["student", "parent", "teacher", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Must be: student, parent, teacher, or admin",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user first (without profileId)
      const user = new User({
        name,
        email,
        password: hashedPassword,
        role,
        phone,
      });
      await user.save();

      // Create role-specific profile and establish 1-to-1 relationship
      let roleProfile = null;
      let profileModel = null;

      try {
        switch (role) {
          case "student":
            const admissionNumber =
              roleData.admissionNumber || (await generateAdmissionNumber());
            roleProfile = await Student.create({
              userId: user._id,
              admissionNumber,
              rollNumber: roleData.rollNumber || null,
              classId: roleData.classId || null,
              section: roleData.section || null,
              academicYear:
                roleData.academicYear ||
                `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
              dateOfBirth: roleData.dateOfBirth || null,
              address: roleData.address || null,
            });
            profileModel = "Student";
            break;

          case "parent":
            roleProfile = await Parent.create({
              userId: user._id,
              children: roleData.linkedStudentIds || [],
              relationshipType: roleData.relationshipType || "guardian",
              occupation: roleData.occupation || null,
              address: roleData.address || null,
            });
            profileModel = "Parent";
            break;

          case "teacher":
            const employeeCode =
              roleData.employeeCode || (await generateEmployeeCode());
            roleProfile = await Teacher.create({
              userId: user._id,
              employeeCode,
              qualification: roleData.qualification || null,
              specialization: roleData.specialization || null,
              joiningDate: roleData.joiningDate || new Date(),
              address: roleData.address || null,
            });
            profileModel = "Teacher";
            break;

          case "admin":
            roleProfile = await Admin.create({
              userId: user._id,
              adminLevel: roleData.adminLevel || "normal",
              department: roleData.department || null,
            });
            profileModel = "Admin";
            break;
        }

        // Update user with profileId and profileModel (establishing 1-to-1 link)
        user.profileId = roleProfile._id;
        user.profileModel = profileModel;
        await user.save();
      } catch (profileError) {
        // Rollback: delete user if profile creation fails
        await User.findByIdAndDelete(user._id);
        throw profileError;
      }

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            profileId: user.profileId,
          },
          roleProfile,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error creating user",
        error: error.message,
      });
    }
  }

  /**
   * Get all users with optional filters
   */
  async getAllUsers(req, res) {
    try {
      const { role, search, page = 1, limit = 50 } = req.query;

      const query = {};
      if (role) query.role = role;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;
      const total = await User.countDocuments(query);
      const users = await User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      res.status(200).json({
        success: true,
        count: users.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: users,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching users",
        error: error.message,
      });
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(req, res) {
    try {
      const { role } = req.params;

      if (!["admin", "teacher", "student", "parent"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role specified",
        });
      }

      const users = await User.find({ role }).select(
        "_id name email phone profileId",
      );

      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching users by role",
        error: error.message,
      });
    }
  }

  /**
   * Get user by ID with role-specific data
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id).select("-password");
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Fetch role-specific profile using profileId
      let roleProfile = null;

      if (user.profileId) {
        switch (user.role) {
          case "student":
            roleProfile = await Student.findById(user.profileId)
              .populate("classId", "name section academicYear")
              .populate({
                path: "parentId",
                populate: { path: "userId", select: "name email phone" },
              });
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

      res.status(200).json({
        success: true,
        data: {
          ...user.toObject(),
          roleProfile,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching user",
        error: error.message,
      });
    }
  }

  /**
   * Update user
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, email, phone } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check email uniqueness if email is being changed
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "Email already in use",
          });
        }
      }

      // Update fields
      if (name) user.name = name;
      if (email) user.email = email;
      if (phone) user.phone = phone;

      await user.save();

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          profileId: user.profileId,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating user",
        error: error.message,
      });
    }
  }

  /**
   * Reset user password
   */
  async resetUserPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error resetting password",
        error: error.message,
      });
    }
  }

  /**
   * Delete user and associated profile (hard delete)
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Delete associated profile based on role
      if (user.profileId) {
        switch (user.role) {
          case "student":
            // Remove from parent's children array if linked
            const student = await Student.findById(user.profileId);
            if (student?.parentId) {
              await Parent.findByIdAndUpdate(student.parentId, {
                $pull: { children: student._id },
              });
            }
            await Student.findByIdAndDelete(user.profileId);
            break;
          case "parent":
            // Remove parentId from all linked students
            await Student.updateMany(
              { parentId: user.profileId },
              { $set: { parentId: null } },
            );
            await Parent.findByIdAndDelete(user.profileId);
            break;
          case "teacher":
            await Teacher.findByIdAndDelete(user.profileId);
            break;
          case "admin":
            await Admin.findByIdAndDelete(user.profileId);
            break;
        }
      }

      // Delete the user
      await User.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error deleting user",
        error: error.message,
      });
    }
  }

  // ============ STUDENT MANAGEMENT ============

  /**
   * Create student with class assignment
   */
  async createStudentWithClassAssignment(req, res) {
    try {
      const {
        name,
        email,
        password,
        phone,
        classId,
        section,
        rollNumber,
        parentId,
        academicYear,
        dateOfBirth,
        address,
        admissionNumber,
      } = req.body;

      // Validate required fields
      if (!name || !email || !password || !phone) {
        return res.status(400).json({
          success: false,
          message: "Required fields: name, email, password, phone",
        });
      }

      // Check if user email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      // Check for duplicate roll number in class (if provided)
      if (classId && rollNumber) {
        const existingRoll = await Student.findOne({
          classId,
          rollNumber,
          academicYear:
            academicYear ||
            `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        });
        if (existingRoll) {
          return res.status(409).json({
            success: false,
            message: "Roll number already exists in this class",
          });
        }
      }

      // Create user account
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        name,
        email,
        password: hashedPassword,
        role: "student",
        phone,
      });
      await user.save();

      // Generate admission number if not provided
      const finalAdmissionNumber =
        admissionNumber || (await generateAdmissionNumber());

      // Create student profile
      const student = new Student({
        userId: user._id,
        admissionNumber: finalAdmissionNumber,
        classId: classId || null,
        section: section || null,
        rollNumber: rollNumber || null,
        parentId: parentId || null,
        academicYear:
          academicYear ||
          `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        dateOfBirth: dateOfBirth || null,
        address: address || null,
      });
      await student.save();

      // Link user to the newly created student profile (1-to-1)
      user.profileId = student._id;
      user.profileModel = "Student";
      await user.save();

      // If parent assigned, update parent's children array
      if (parentId) {
        await Parent.findByIdAndUpdate(parentId, {
          $addToSet: { children: student._id },
        });
      }

      res.status(201).json({
        success: true,
        message: "Student enrolled successfully",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          student,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error enrolling student",
        error: error.message,
      });
    }
  }

  /**
   * Get all students with class info
   */
  async getAllStudents(req, res) {
    try {
      const { search, classId, section, academicYear } = req.query;

      // Build query for students
      const studentQuery = {};
      if (classId) studentQuery.classId = classId;
      if (section) studentQuery.section = section;
      if (academicYear) studentQuery.academicYear = academicYear;

      // Fetch students with populated user data
      let students = await Student.find(studentQuery)
        .populate("userId", "name email phone")
        .populate("classId", "name section academicYear")
        .populate({
          path: "parentId",
          populate: { path: "userId", select: "name email phone" },
        })
        .sort({ createdAt: -1 });

      // Apply search filter on user name
      if (search) {
        students = students.filter(
          (s) =>
            s.userId &&
            s.userId.name?.toLowerCase().includes(search.toLowerCase()),
        );
      }

      // Filter out students without valid user reference
      students = students.filter((s) => s.userId);

      res.status(200).json({
        success: true,
        count: students.length,
        data: students,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching students",
        error: error.message,
      });
    }
  }

  /**
   * Get students by class
   */
  async getStudentsByClass(req, res) {
    try {
      const { classId } = req.params;

      const students = await Student.find({ classId })
        .populate("userId", "name email phone")
        .populate({
          path: "parentId",
          populate: { path: "userId", select: "name email phone" },
        })
        .sort({ rollNumber: 1 });

      res.status(200).json({
        success: true,
        count: students.length,
        data: students,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching students",
        error: error.message,
      });
    }
  }

  /**
   * Get student profile by user ID
   */
  async getStudentProfileByUserId(req, res) {
    try {
      const { userId } = req.params;

      const student = await Student.findOne({ userId })
        .populate("userId", "name email phone")
        .populate("classId", "name section academicYear subjects")
        .populate({
          path: "parentId",
          populate: { path: "userId", select: "name email phone" },
        });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found",
        });
      }

      res.status(200).json({
        success: true,
        data: student,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching student profile",
        error: error.message,
      });
    }
  }

  /**
   * Update student info
   */
  async updateStudent(req, res) {
    try {
      const { id } = req.params;
      const {
        classId,
        section,
        rollNumber,
        parentId,
        academicYear,
        dateOfBirth,
        address,
        enrollmentStatus,
      } = req.body;

      const student = await Student.findById(id);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      // Check roll number uniqueness if changing
      if (rollNumber && rollNumber !== student.rollNumber) {
        const existingRoll = await Student.findOne({
          classId: classId || student.classId,
          rollNumber,
          academicYear: academicYear || student.academicYear,
          _id: { $ne: id },
        });
        if (existingRoll) {
          return res.status(409).json({
            success: false,
            message: "Roll number already exists in this class",
          });
        }
      }

      // Handle parent change
      if (parentId !== undefined && parentId !== student.parentId?.toString()) {
        // Remove from old parent
        if (student.parentId) {
          await Parent.findByIdAndUpdate(student.parentId, {
            $pull: { children: student._id },
          });
        }
        // Add to new parent
        if (parentId) {
          await Parent.findByIdAndUpdate(parentId, {
            $addToSet: { children: student._id },
          });
        }
      }

      // Update fields
      if (classId !== undefined) student.classId = classId || null;
      if (section !== undefined) student.section = section || null;
      if (rollNumber !== undefined) student.rollNumber = rollNumber || null;
      if (parentId !== undefined) student.parentId = parentId || null;
      if (academicYear) student.academicYear = academicYear;
      if (dateOfBirth !== undefined) student.dateOfBirth = dateOfBirth;
      if (address !== undefined) student.address = address;
      if (enrollmentStatus) student.enrollmentStatus = enrollmentStatus;

      await student.save();

      const updatedStudent = await Student.findById(id)
        .populate("userId", "name email phone")
        .populate("classId", "name section")
        .populate({
          path: "parentId",
          populate: { path: "userId", select: "name email phone" },
        });

      res.status(200).json({
        success: true,
        message: "Student updated successfully",
        data: updatedStudent,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating student",
        error: error.message,
      });
    }
  }

  /**
   * Assign parent to student
   */
  async assignParentToStudent(req, res) {
    try {
      const { studentId, parentId } = req.body;

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      const parent = await Parent.findById(parentId);
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found",
        });
      }

      // Remove from old parent if exists
      if (student.parentId) {
        await Parent.findByIdAndUpdate(student.parentId, {
          $pull: { children: student._id },
        });
      }

      // Assign new parent
      student.parentId = parentId;
      await student.save();

      // Add student to parent's children
      await Parent.findByIdAndUpdate(parentId, {
        $addToSet: { children: student._id },
      });

      res.status(200).json({
        success: true,
        message: "Parent assigned successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error assigning parent",
        error: error.message,
      });
    }
  }

  /**
   * Change student class (mid-session transfer)
   */
  async changeStudentClass(req, res) {
    try {
      const { studentId, newClassId, newSection, newRollNumber } = req.body;

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      // Check roll number uniqueness in new class
      if (newRollNumber) {
        const existingRoll = await Student.findOne({
          classId: newClassId,
          rollNumber: newRollNumber,
          academicYear: student.academicYear,
          _id: { $ne: studentId },
        });
        if (existingRoll) {
          return res.status(409).json({
            success: false,
            message: "Roll number already exists in the new class",
          });
        }
      }

      student.classId = newClassId;
      student.section = newSection || student.section;
      student.rollNumber = newRollNumber || null;
      await student.save();

      const updatedStudent = await Student.findById(studentId)
        .populate("userId", "name email phone")
        .populate("classId", "name section");

      res.status(200).json({
        success: true,
        message: "Student class changed successfully",
        data: updatedStudent,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error changing student class",
        error: error.message,
      });
    }
  }

  // ============ PARENT MANAGEMENT ============

  /**
   * Get all parents
   */
  async getAllParents(req, res) {
    try {
      const parents = await Parent.find()
        .populate("userId", "name email phone")
        .populate({
          path: "children",
          populate: [
            { path: "userId", select: "name email" },
            { path: "classId", select: "name section" },
          ],
        });

      // Filter parents with valid user reference
      const validParents = parents.filter((p) => p.userId);

      res.status(200).json({
        success: true,
        count: validParents.length,
        data: validParents,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching parents",
        error: error.message,
      });
    }
  }

  /**
   * Link child to parent
   */
  async linkChildToParent(req, res) {
    try {
      const { parentId, studentId } = req.body;
      // Resolve Parent profile (accept parent profileId OR parent userId)
      const parent =
        (await Parent.findById(parentId)) ||
        (await Parent.findOne({ userId: parentId }));

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found",
        });
      }

      // Resolve Student profile (accept student profileId OR student userId)
      const student =
        (await Student.findById(studentId)) ||
        (await Student.findOne({ userId: studentId }));

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      const parentProfileId = parent._id.toString();

      // Remove from old parent if exists
      if (student.parentId && student.parentId.toString() !== parentProfileId) {
        await Parent.findByIdAndUpdate(student.parentId, {
          $pull: { children: student._id },
        });
      }

      // Update student's parentId (must be Parent profileId)
      student.parentId = parent._id;
      await student.save();

      // Add to parent's children (Parent profileId)
      await Parent.findByIdAndUpdate(parent._id, {
        $addToSet: { children: student._id },
      });

      res.status(200).json({
        success: true,
        message: "Child linked to parent successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error linking child to parent",
        error: error.message,
      });
    }
  }

  /**
   * Unlink child from parent
   */
  async unlinkChildFromParent(req, res) {
    try {
      const { parentId, studentId } = req.body;

      // Resolve Parent profile (accept parent profileId OR parent userId)
      const parent =
        (await Parent.findById(parentId)) ||
        (await Parent.findOne({ userId: parentId }));

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found",
        });
      }

      // Resolve Student profile (accept student profileId OR student userId)
      const student =
        (await Student.findById(studentId)) ||
        (await Student.findOne({ userId: studentId }));

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      // Remove from parent's children
      await Parent.findByIdAndUpdate(parent._id, {
        $pull: { children: student._id },
      });

      // Remove parent from student
      await Student.findByIdAndUpdate(student._id, {
        $set: { parentId: null },
      });

      res.status(200).json({
        success: true,
        message: "Child unlinked from parent successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error unlinking child from parent",
        error: error.message,
      });
    }
  }

  /**
   * Get children by parent ID
   */
  async getChildrenByParentId(req, res) {
    try {
      const { parentId } = req.params;

      const parent = await Parent.findById(parentId).populate({
        path: "children",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "classId", select: "name section" },
        ],
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found",
        });
      }

      res.status(200).json({
        success: true,
        count: parent.children.length,
        data: parent.children,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching children",
        error: error.message,
      });
    }
  }

  // ============ TEACHER MANAGEMENT ============

  /**
   * Get all teachers
   */
  async getAllTeachers(req, res) {
    try {
      const teachers = await Teacher.find()
        .populate("userId", "name email phone")
        .populate("assignedClasses", "name section")
        .populate("assignedSubjects", "name code");

      // Filter teachers with valid user reference
      const validTeachers = teachers.filter((t) => t.userId);

      res.status(200).json({
        success: true,
        count: validTeachers.length,
        data: validTeachers,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching teachers",
        error: error.message,
      });
    }
  }

  /**
   * Get teacher by ID
   */
  async getTeacherById(req, res) {
    try {
      const { teacherId } = req.params;

      const teacher = await Teacher.findById(teacherId)
        .populate("userId", "name email phone")
        .populate("assignedClasses", "name section academicYear")
        .populate({
          path: "assignedSubjects",
          populate: { path: "classId", select: "name section" },
        });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      res.status(200).json({
        success: true,
        data: teacher,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching teacher",
        error: error.message,
      });
    }
  }

  /**
   * Update teacher profile
   */
  async updateTeacher(req, res) {
    try {
      const { teacherId } = req.params;
      const {
        qualification,
        specialization,
        employmentStatus,
        address,
        experience,
      } = req.body;

      const teacher = await Teacher.findById(teacherId);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      if (qualification !== undefined) teacher.qualification = qualification;
      if (specialization !== undefined) teacher.specialization = specialization;
      if (employmentStatus) teacher.employmentStatus = employmentStatus;
      if (address !== undefined) teacher.address = address;
      if (experience !== undefined) teacher.experience = experience;

      await teacher.save();

      res.status(200).json({
        success: true,
        message: "Teacher updated successfully",
        data: teacher,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating teacher",
        error: error.message,
      });
    }
  }

  // ============ CLASS & TEACHER ASSIGNMENTS ============

  /**
   * Assign class teacher
   */
  async assignClassTeacher(req, res) {
    try {
      const { classId, teacherId } = req.body;

      const classDoc = await Class.findById(classId);
      if (!classDoc) {
        return res.status(404).json({
          success: false,
          message: "Class not found",
        });
      }

      const teacher = await resolveTeacherProfile(teacherId);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      const teacherProfileId = teacher._id.toString();

      // Remove class from old teacher's assignedClasses if exists
      if (
        classDoc.classTeacher &&
        classDoc.classTeacher.toString() !== teacherProfileId
      ) {
        await Teacher.findByIdAndUpdate(classDoc.classTeacher, {
          $pull: { assignedClasses: classId },
        });
      }

      classDoc.classTeacher = teacher._id;
      await classDoc.save();

      // Add class to new teacher's assigned classes
      await Teacher.findByIdAndUpdate(teacher._id, {
        $addToSet: { assignedClasses: classId },
      });

      const updatedClass = await Class.findById(classId).populate({
        path: "classTeacher",
        populate: { path: "userId", select: "name email phone" },
      });

      res.status(200).json({
        success: true,
        message: "Class teacher assigned successfully",
        data: updatedClass,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error assigning class teacher",
        error: error.message,
      });
    }
  }

  /**
   * Remove class teacher
   */
  async removeClassTeacher(req, res) {
    try {
      const { classId } = req.body;

      const classDoc = await Class.findById(classId);
      if (!classDoc) {
        return res.status(404).json({
          success: false,
          message: "Class not found",
        });
      }

      // Remove class from teacher's assignedClasses
      if (classDoc.classTeacher) {
        await Teacher.findByIdAndUpdate(classDoc.classTeacher, {
          $pull: { assignedClasses: classId },
        });
      }

      classDoc.classTeacher = null;
      await classDoc.save();

      res.status(200).json({
        success: true,
        message: "Class teacher removed successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error removing class teacher",
        error: error.message,
      });
    }
  }

  /**
   * Get all classes with teacher info
   */
  async getAllClassesWithTeachers(req, res) {
    try {
      const classes = await Class.find({ isActive: true })
        .populate({
          path: "classTeacher",
          populate: { path: "userId", select: "name email phone" },
        })
        .populate("subjects", "name code")
        .sort({ name: 1, section: 1 });

      res.status(200).json({
        success: true,
        count: classes.length,
        data: classes,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching classes",
        error: error.message,
      });
    }
  }

  // ============ SUBJECT & TEACHER ASSIGNMENTS ============

  /**
   * Assign teacher to subject
   */
  async assignTeacherToSubject(req, res) {
    try {
      const { subjectId, teacherId } = req.body;

      const subject = await Subject.findById(subjectId);
      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      const teacher = await resolveTeacherProfile(teacherId);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      const teacherProfileId = teacher._id.toString();

      // Remove subject from old teacher if exists
      if (
        subject.assignedTeacher &&
        subject.assignedTeacher.toString() !== teacherProfileId
      ) {
        await Teacher.findByIdAndUpdate(subject.assignedTeacher, {
          $pull: { assignedSubjects: subjectId },
        });
      }

      subject.assignedTeacher = teacher._id;
      await subject.save();

      // Add subject to teacher's assigned subjects
      await Teacher.findByIdAndUpdate(teacher._id, {
        $addToSet: { assignedSubjects: subjectId },
      });

      res.status(200).json({
        success: true,
        message: "Teacher assigned to subject successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error assigning teacher to subject",
        error: error.message,
      });
    }
  }

  /**
   * Get teacher's assigned classes and subjects
   */
  async getTeacherAssignments(req, res) {
    try {
      const { teacherId } = req.params;

      const resolvedTeacher = await resolveTeacherProfile(teacherId);
      if (!resolvedTeacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      const teacher = await Teacher.findById(resolvedTeacher._id)
        .populate("userId", "name email phone")
        .populate("assignedClasses", "name section academicYear")
        .populate({
          path: "assignedSubjects",
          populate: { path: "classId", select: "name section" },
        });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Get classes where this teacher is class teacher (tolerate legacy data)
      const classTeacherOr = [
        teacher?._id ? { classTeacher: teacher._id } : null,
        teacher?.userId?._id ? { classTeacher: teacher.userId._id } : null,
      ].filter(Boolean);

      const classTeacherOf = classTeacherOr.length
        ? await Class.find({ $or: classTeacherOr }).select(
            "name section academicYear",
          )
        : [];

      // Source of truth for subject-teacher assignment is Subject.assignedTeacher.
      // This makes the UI correct even if assignments were created via /subjects/:id/assign-teacher
      // (which may not always keep Teacher.assignedSubjects in sync).
      const subjectsByAssignedTeacher = await Subject.find({
        assignedTeacher: teacher._id,
      })
        .populate("classId", "name section academicYear")
        .populate("classIds", "name section academicYear")
        .lean();

      // Merge teacher.assignedSubjects (if present) with subjectsByAssignedTeacher
      const mergedSubjectsMap = new Map();
      (Array.isArray(teacher.assignedSubjects)
        ? teacher.assignedSubjects
        : []
      ).forEach((s) => {
        const id = s?._id ? String(s._id) : String(s);
        if (!id) return;
        mergedSubjectsMap.set(id, s);
      });
      (Array.isArray(subjectsByAssignedTeacher)
        ? subjectsByAssignedTeacher
        : []
      ).forEach((s) => {
        const id = s?._id ? String(s._id) : String(s);
        if (!id) return;
        mergedSubjectsMap.set(id, s);
      });

      const resolvedAssignedSubjects = Array.from(mergedSubjectsMap.values());

      // Get student count for assigned classes
      let totalStudents = 0;
      if (teacher.assignedClasses && teacher.assignedClasses.length > 0) {
        const classIds = teacher.assignedClasses.map((c) => c._id);
        totalStudents = await Student.countDocuments({
          classId: { $in: classIds },
          enrollmentStatus: "active",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          teacher: {
            id: teacher._id,
            userId: teacher.userId,
            employeeCode: teacher.employeeCode,
          },
          assignedClasses: teacher.assignedClasses,
          assignedSubjects: resolvedAssignedSubjects,
          classTeacherOf,
          totalStudents,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching teacher assignments",
        error: error.message,
      });
    }
  }

  // ============ DASHBOARD DATA ============

  /**
   * Get parent dashboard data
   */
  async getParentDashboardData(req, res) {
    try {
      const { parentId } = req.params;

      const parent = await Parent.findById(parentId)
        .populate("userId", "name email phone")
        .populate({
          path: "children",
          populate: [
            { path: "userId", select: "name email phone" },
            {
              path: "classId",
              select: "name section academicYear classTeacher subjects",
              populate: [
                {
                  path: "classTeacher",
                  populate: { path: "userId", select: "name email phone" },
                },
                { path: "subjects", select: "name code" },
              ],
            },
          ],
        });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          parent: parent.userId,
          parentProfile: parent,
          children: parent.children,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching parent dashboard data",
        error: error.message,
      });
    }
  }

  /**
   * Get student dashboard data
   */
  async getStudentDashboardData(req, res) {
    try {
      const { studentId } = req.params;

      const student = await Student.findById(studentId)
        .populate("userId", "name email phone")
        .populate({
          path: "classId",
          populate: [
            {
              path: "classTeacher",
              populate: { path: "userId", select: "name email phone" },
            },
            {
              path: "subjects",
              select: "name code assignedTeacher",
              populate: {
                path: "assignedTeacher",
                populate: { path: "userId", select: "name" },
              },
            },
          ],
        })
        .populate({
          path: "parentId",
          populate: { path: "userId", select: "name email phone" },
        });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          student,
          classInfo: student.classId,
          classTeacher: student.classId?.classTeacher,
          parentInfo: student.parentId,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching student dashboard data",
        error: error.message,
      });
    }
  }

  /**
   * Get teacher dashboard data
   */
  async getTeacherDashboardData(req, res) {
    try {
      const { teacherId } = req.params;

      const resolvedTeacher = await resolveTeacherProfile(teacherId);
      if (!resolvedTeacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      const teacherProfileId = resolvedTeacher._id;

      const teacher = await Teacher.findById(teacherProfileId)
        .populate("userId", "name email phone")
        .populate("assignedClasses", "name section academicYear")
        .populate({
          path: "assignedSubjects",
          populate: { path: "classId", select: "name section" },
        });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Get classes where this teacher is class teacher
      const classTeacherOf = await Class.find({
        classTeacher: teacherProfileId,
      }).select("name section academicYear");

      // Get student count for assigned classes
      let totalStudents = 0;
      if (teacher.assignedClasses && teacher.assignedClasses.length > 0) {
        const classIds = teacher.assignedClasses.map((c) => c._id);
        totalStudents = await Student.countDocuments({
          classId: { $in: classIds },
          enrollmentStatus: "active",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          teacher: {
            id: teacher._id,
            userId: teacher.userId,
            employeeCode: teacher.employeeCode,
            qualification: teacher.qualification,
            specialization: teacher.specialization,
          },
          assignedClasses: teacher.assignedClasses,
          assignedSubjects: teacher.assignedSubjects,
          classTeacherOf,
          totalStudents,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching teacher dashboard data",
        error: error.message,
      });
    }
  }

  /**
   * Get dashboard stats for admin
   */
  async getDashboardStats(req, res) {
    try {
      const [
        totalUsers,
        totalStudents,
        totalTeachers,
        totalParents,
        totalClasses,
        totalSubjects,
        activeStudents,
        activeTeachers,
      ] = await Promise.all([
        User.countDocuments(),
        Student.countDocuments(),
        Teacher.countDocuments(),
        Parent.countDocuments(),
        Class.countDocuments({ isActive: true }),
        Subject.countDocuments({ isActive: true }),
        Student.countDocuments({ enrollmentStatus: "active" }),
        Teacher.countDocuments({ employmentStatus: "active" }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalStudents,
          totalTeachers,
          totalParents,
          totalClasses,
          totalSubjects,
          activeStudents,
          activeTeachers,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching dashboard stats",
        error: error.message,
      });
    }
  }
}

export default new AdminController();
