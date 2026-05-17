import Attendance from "../models/attendance.model.js";
import Student from "../models/student.model.js";
import Teacher from "../models/teacher.model.js";
import Class from "../models/class.model.js";
import Subject from "../models/subject.model.js";
import Schedule from "../models/schedule.model.js";
import mongoose from "mongoose";

/**
 * Attendance Controller
 * Updated to work with the reference-based design:
 * - Student model contains studentId (references Student, not User)
 * - Teacher references Teacher model
 */

/**
 * Mark attendance for students
 * POST /api/attendance/mark
 * Access: Admin, Teacher
 */
export const markAttendance = async (req, res) => {
  try {
    const { classId, subjectId, date, attendanceRecords } = req.body;
    const user = req.user;

    // Validate required fields
    if (
      !classId ||
      !subjectId ||
      !date ||
      !attendanceRecords ||
      !Array.isArray(attendanceRecords)
    ) {
      return res.status(400).json({
        success: false,
        message: "Class, subject, date, and attendance records are required",
      });
    }

    // Verify class exists
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Verify subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    // Get teacher record for current user
    let teacherRecord = null;
    if (user.role === "teacher") {
      if (!user.profileId) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }
      teacherRecord = await Teacher.findById(user.profileId);
      if (!teacherRecord) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }

      // Verify teacher is assigned to this class/subject
      const schedule = await Schedule.findOne({
        classId: classId,
        subjectId: subjectId,
        teacherId: teacherRecord._id,
      });

      if (!schedule) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to teach this subject in this class",
        });
      }
    } else if (user.role === "admin") {
      // For admin, get the assigned teacher for this class/subject
      const schedule = await Schedule.findOne({
        classId: classId,
        subjectId: subjectId,
      });
      if (schedule) {
        teacherRecord = await Teacher.findById(schedule.teacherId);
      }
    }

    // Validate date (cannot mark future attendance)
    const attendanceDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (attendanceDate > today) {
      return res.status(400).json({
        success: false,
        message: "Cannot mark attendance for future dates",
      });
    }

    const savedRecords = [];
    const errors = [];

    // Process each attendance record
    for (const record of attendanceRecords) {
      const { studentId, status, remarks } = record;

      try {
        // Verify student exists
        const student = await Student.findById(studentId);
        if (!student) {
          errors.push({
            studentId,
            message: "Invalid student",
          });
          continue;
        }

        // Check if attendance already exists for this student/subject/date
        const existingAttendance = await Attendance.findOne({
          studentId: studentId,
          subjectId: subjectId,
          date: attendanceDate,
        });

        if (existingAttendance) {
          // Update existing attendance
          existingAttendance.status = status;
          existingAttendance.remarks = remarks || existingAttendance.remarks;
          existingAttendance.markedBy = teacherRecord?._id || null;

          await existingAttendance.save();
          savedRecords.push(existingAttendance);
        } else {
          // Create new attendance record
          const attendance = new Attendance({
            studentId: studentId,
            classId: classId,
            subjectId: subjectId,
            date: attendanceDate,
            status,
            remarks,
            markedBy: teacherRecord?._id || null,
          });

          await attendance.save();
          savedRecords.push(attendance);
        }
      } catch (error) {
        errors.push({
          studentId,
          message: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: {
        saved: savedRecords.length,
        errors: errors.length,
        records: savedRecords,
        failedRecords: errors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking attendance",
      error: error.message,
    });
  }
};

/**
 * Get students for attendance marking
 * GET /api/attendance/students?classId=<id>&subjectId=<id>
 * Access: Admin, Teacher
 */
export const getStudentsForAttendance = async (req, res) => {
  try {
    const { classId, subjectId } = req.query;
    const user = req.user;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: "classId is required",
      });
    }

    if (!mongoose.isValidObjectId(classId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid classId",
      });
    }

    if (subjectId && !mongoose.isValidObjectId(subjectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subjectId",
      });
    }

    const classDoc = await Class.findById(classId).select("_id classTeacher");
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // If teacher, verify they are assigned to this class (+ subject if provided)
    if (user.role === "teacher") {
      if (!user.profileId) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }

      const teacherRecord = await Teacher.findById(user.profileId)
        .select("_id userId assignedClasses assignedSubjects")
        .lean();

      if (!teacherRecord) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }

      const teacherProfileId = String(teacherRecord._id);
      const teacherUserId = teacherRecord.userId
        ? String(teacherRecord.userId)
        : null;

      // Tolerate legacy data where classTeacher might mistakenly store a userId.
      const classTeacherValue = classDoc.classTeacher
        ? String(classDoc.classTeacher)
        : null;
      const isClassTeacher =
        !!classTeacherValue &&
        (classTeacherValue === teacherProfileId ||
          (teacherUserId && classTeacherValue === teacherUserId));

      const isAssignedClass = Array.isArray(teacherRecord.assignedClasses)
        ? teacherRecord.assignedClasses.some(
            (c) => String(c) === String(classId),
          )
        : false;

      const isAssignedSubject = subjectId
        ? Array.isArray(teacherRecord.assignedSubjects)
          ? teacherRecord.assignedSubjects.some(
              (s) => String(s) === String(subjectId),
            )
          : false
        : true;

      // Allow access if teacher is class teacher OR explicitly assigned to the class
      // (and subject when subjectId is provided).
      const canAccessByManualAssignment = isAssignedClass && isAssignedSubject;

      if (!isClassTeacher && !canAccessByManualAssignment) {
        const scheduleQuery = {
          classId,
          teacherId: user.profileId,
        };

        if (subjectId) {
          scheduleQuery.subjectId = subjectId;
        }

        const schedule = await Schedule.findOne(scheduleQuery).select("_id");
        if (!schedule) {
          return res.status(403).json({
            success: false,
            message: "You are not assigned to this class/subject",
          });
        }
      }
    }

    // Be tolerant of legacy data where enrollmentStatus may be missing or stored with different casing.
    const students = await Student.find({
      classId,
      $or: [
        { enrollmentStatus: "active" },
        { enrollmentStatus: { $exists: false } },
        { enrollmentStatus: null },
        { enrollmentStatus: { $regex: /^active$/i } },
      ],
    })
      .populate("userId", "name email phone")
      .sort({ rollNumber: 1 });

    return res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    // Helpful diagnostics for common runtime issues (e.g., CastError)
    console.error("getStudentsForAttendance error:", {
      name: error?.name,
      message: error?.message,
    });

    if (error?.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid id format",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error fetching students",
      error: error.message,
    });
  }
};

/**
 * Update attendance record
 * PUT /api/attendance/:id
 * Access: Admin, Teacher (own class only)
 */
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const user = req.user;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // If teacher, verify they are the assigned teacher
    if (user.role === "teacher") {
      if (!user.profileId) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }
      const teacherRecord = await Teacher.findById(user.profileId);
      if (!teacherRecord) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }

      const schedule = await Schedule.findOne({
        classId: attendance.classId,
        subjectId: attendance.subjectId,
        teacherId: teacherRecord._id,
      });

      if (!schedule) {
        return res.status(403).json({
          success: false,
          message: "You can only update attendance for your assigned classes",
        });
      }

      attendance.markedBy = teacherRecord._id;
    }

    attendance.status = status;
    if (remarks !== undefined) {
      attendance.remarks = remarks;
    }

    await attendance.save();

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate({
        path: "studentId",
        populate: { path: "userId", select: "name email" },
      })
      .populate("classId", "name section")
      .populate("subjectId", "name")
      .populate({
        path: "markedBy",
        populate: { path: "userId", select: "name" },
      });

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: populatedAttendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating attendance",
      error: error.message,
    });
  }
};

/**
 * Get attendance by class and date
 * GET /api/attendance/class?classId=xxx&subjectId=xxx&date=xxx
 * Access: Admin, Teacher
 */
export const getAttendanceByClassAndDate = async (req, res) => {
  try {
    const { classId, subjectId, date, startDate, endDate } = req.query;
    const user = req.user;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: "Class ID is required",
      });
    }

    // Build query
    const query = { classId: classId };

    if (subjectId) {
      query.subjectId = subjectId;
    }

    // If teacher, verify they teach this class
    if (user.role === "teacher") {
      const teacherRecord = await Teacher.findOne({ userId: user._id });
      if (!teacherRecord) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }

      const scheduleQuery = { classId, teacherId: teacherRecord._id };
      if (subjectId) {
        scheduleQuery.subjectId = subjectId;
      }

      const schedule = await Schedule.findOne(scheduleQuery);
      if (!schedule) {
        return res.status(403).json({
          success: false,
          message: "You can only view attendance for your assigned classes",
        });
      }
    }

    // Handle date filtering
    if (date) {
      const searchDate = new Date(date);
      searchDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.date = {
        $gte: searchDate,
        $lt: nextDay,
      };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: "studentId",
        populate: { path: "userId", select: "name email" },
      })
      .populate("classId", "name section")
      .populate("subjectId", "name")
      .populate({
        path: "markedBy",
        populate: { path: "userId", select: "name" },
      })
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching attendance",
      error: error.message,
    });
  }
};

/**
 * Get attendance for a specific student
 * GET /api/attendance/student?studentId=xxx&startDate=xxx&endDate=xxx
 * Access: Student (own only), Parent (children only), Admin
 */
export const getAttendanceByStudent = async (req, res) => {
  try {
    const { studentId, startDate, endDate, subjectId } = req.query;
    const user = req.user;

    let targetStudentId;

    // Students can only view their own attendance
    if (user.role === "student") {
      const studentRecord = await Student.findById(user.profileId);
      if (!studentRecord) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found",
        });
      }
      targetStudentId = studentRecord._id;
    } else if (user.role === "admin" || user.role === "teacher") {
      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "Student ID is required",
        });
      }
      targetStudentId = studentId;
    } else if (user.role === "parent") {
      // Parents can view their children's attendance
      const Parent = (await import("../models/parent.model.js")).default;
      const parentRecord = await Parent.findById(user.profileId);
      if (!parentRecord) {
        return res.status(404).json({
          success: false,
          message: "Parent profile not found",
        });
      }

      // Check if the requested student is one of parent's children
      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "Student ID is required",
        });
      }

      if (!parentRecord.children.some((id) => id.toString() === studentId)) {
        return res.status(403).json({
          success: false,
          message: "You can only view your children's attendance",
        });
      }
      targetStudentId = studentId;
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const query = { studentId: targetStudentId };

    // Add date range filter
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Add subject filter
    if (subjectId) {
      query.subjectId = subjectId;
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: "studentId",
        populate: { path: "userId", select: "name email" },
      })
      .populate("classId", "name section")
      .populate("subjectId", "name")
      .populate({
        path: "markedBy",
        populate: { path: "userId", select: "name" },
      })
      .sort({ date: -1 });

    // Calculate statistics
    const totalClasses = attendance.length;
    const presentCount = attendance.filter(
      (a) => a.status === "present",
    ).length;
    const absentCount = attendance.filter((a) => a.status === "absent").length;
    const lateCount = attendance.filter((a) => a.status === "late").length;
    const excusedCount = attendance.filter(
      (a) => a.status === "excused",
    ).length;
    const attendancePercentage =
      totalClasses > 0
        ? (((presentCount + lateCount) / totalClasses) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance,
      statistics: {
        totalClasses,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        excused: excusedCount,
        attendancePercentage: parseFloat(attendancePercentage),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching attendance",
      error: error.message,
    });
  }
};

/**
 * Get attendance for logged-in student
 * GET /api/attendance/my
 * Access: Student only
 */
export const getMyAttendance = async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate, subjectId, classId } = req.query;

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is for students only",
      });
    }

    // Get student record
    const studentRecord = await Student.findOne({ userId: user._id });
    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const query = { studentId: studentRecord._id };

    // Add date range filter
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Add subject filter
    if (subjectId) {
      query.subjectId = subjectId;
    }

    // Add class filter
    if (classId) {
      query.classId = classId;
    }

    const attendance = await Attendance.find(query)
      .populate("classId", "name section")
      .populate("subjectId", "name code")
      .populate({
        path: "markedBy",
        populate: { path: "userId", select: "name" },
      })
      .sort({ date: -1 });

    // Calculate statistics
    const totalClasses = attendance.length;
    const presentCount = attendance.filter(
      (a) => a.status === "present",
    ).length;
    const absentCount = attendance.filter((a) => a.status === "absent").length;
    const lateCount = attendance.filter((a) => a.status === "late").length;
    const excusedCount = attendance.filter(
      (a) => a.status === "excused",
    ).length;
    const attendancePercentage =
      totalClasses > 0
        ? (((presentCount + lateCount) / totalClasses) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance,
      statistics: {
        totalClasses,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        excused: excusedCount,
        attendancePercentage: parseFloat(attendancePercentage),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching attendance",
      error: error.message,
    });
  }
};

/**
 * Delete attendance record
 * DELETE /api/attendance/:id
 * Access: Admin only
 */
export const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    await Attendance.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting attendance",
      error: error.message,
    });
  }
};

/**
 * Get attendance statistics for a class
 * GET /api/attendance/stats?classId=xxx&startDate=xxx&endDate=xxx
 * Access: Admin, Teacher
 */
export const getAttendanceStats = async (req, res) => {
  try {
    const { classId, subjectId, startDate, endDate } = req.query;
    const user = req.user;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: "Class ID is required",
      });
    }

    // If teacher, verify they teach this class
    if (user.role === "teacher") {
      const teacherRecord = await Teacher.findOne({ userId: user._id });
      if (!teacherRecord) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }

      const schedule = await Schedule.findOne({
        classId,
        teacherId: teacherRecord._id,
      });

      if (!schedule) {
        return res.status(403).json({
          success: false,
          message: "You can only view statistics for your assigned classes",
        });
      }
    }

    // Build match query
    const matchQuery = { classId: new mongoose.Types.ObjectId(classId) };

    if (subjectId) {
      matchQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    if (startDate && endDate) {
      matchQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Aggregate attendance stats
    const stats = await Attendance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get total students in class
    const totalStudents = await Student.countDocuments({
      classId,
      $or: [
        { enrollmentStatus: "active" },
        { enrollmentStatus: { $exists: false } },
        { enrollmentStatus: null },
        { enrollmentStatus: { $regex: /^active$/i } },
      ],
    });

    // Format stats
    const formattedStats = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
    };

    stats.forEach((stat) => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    formattedStats.totalStudents = totalStudents;
    formattedStats.attendancePercentage =
      formattedStats.total > 0
        ? (
            ((formattedStats.present + formattedStats.late) /
              formattedStats.total) *
            100
          ).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching attendance statistics",
      error: error.message,
    });
  }
};

export default {
  markAttendance,
  updateAttendance,
  getAttendanceByClassAndDate,
  getAttendanceByStudent,
  getMyAttendance,
  deleteAttendance,
  getAttendanceStats,
};
