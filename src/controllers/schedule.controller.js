import scheduleService from "../services/schedule.service.js";
import Teacher from "../models/teacher.model.js";
import Student from "../models/student.model.js";
import Parent from "../models/parent.model.js";
import mongoose from "mongoose";

const getDefaultAcademicYear = () => {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
};

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const emptyGroupedByDay = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

/**
 * Create a new schedule entry
 * @route POST /api/schedules
 * @access Admin only
 */
export const createSchedule = async (req, res) => {
  try {
    const schedule = await scheduleService.createSchedule(req.body);

    res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      data: schedule,
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
        conflicts: error.conflicts,
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create schedule",
    });
  }
};

/**
 * Get all schedules with optional filters
 * @route GET /api/schedules
 * @access All authenticated users (filtered by role)
 */
export const getSchedules = async (req, res) => {
  try {
    // Backwards-compatible endpoint:
    // - Admin: behaves like admin schedules list (with optional filters)
    // - Teacher/Student/Parent: behaves like their own schedule endpoint

    if (req.user.role === "admin") {
      return await getAdminSchedules(req, res);
    }
    if (req.user.role === "teacher") {
      return await getTeacherSchedulesForMe(req, res);
    }
    if (req.user.role === "student") {
      return await getStudentSchedulesForMe(req, res);
    }
    if (req.user.role === "parent") {
      return await getParentSchedulesForMe(req, res);
    }

    return res.status(403).json({
      success: false,
      message: "Unsupported role",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch schedules",
    });
  }
};

/**
 * Admin: fetch all schedules with filters
 * @route GET /api/schedules/admin
 */
export const getAdminSchedules = async (req, res) => {
  try {
    const filters = {};
    if (req.query.classId) filters.classId = req.query.classId;
    if (req.query.section) filters.section = req.query.section;
    if (req.query.teacherId) filters.teacherId = req.query.teacherId;
    if (req.query.dayOfWeek) filters.dayOfWeek = req.query.dayOfWeek;
    if (req.query.academicYear) filters.academicYear = req.query.academicYear;

    const result = await scheduleService.getSchedulesUiReady(filters);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch schedules",
    });
  }
};

/**
 * Teacher: fetch schedules for logged in teacher (profileId)
 * @route GET /api/schedules/teacher
 */
export const getTeacherSchedulesForMe = async (req, res) => {
  try {
    const teacherProfileId = req.user.profileId;
    if (!teacherProfileId) {
      return res.status(400).json({
        success: false,
        message: "Teacher profileId missing on user",
      });
    }

    const teacher = await Teacher.findById(teacherProfileId).populate(
      "userId",
      "name",
    );
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found",
      });
    }

    const filters = {
      teacherId: teacher._id,
    };
    if (req.query.dayOfWeek) filters.dayOfWeek = req.query.dayOfWeek;
    if (req.query.academicYear) filters.academicYear = req.query.academicYear;

    const result = await scheduleService.getSchedulesUiReady(filters);

    return res.status(200).json({
      success: true,
      data: {
        ...result,
        meta: {
          teacher: { _id: teacher._id, name: teacher.userId?.name || null },
        },
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch teacher schedules",
    });
  }
};

/**
 * Student: fetch schedules for logged in student's class/section/year
 * @route GET /api/schedules/student
 */
export const getStudentSchedulesForMe = async (req, res) => {
  try {
    const studentProfileId = req.user.profileId;
    if (!studentProfileId) {
      return res.status(400).json({
        success: false,
        message: "Student profileId missing on user",
      });
    }

    const student = await Student.findById(studentProfileId)
      .populate("userId", "name")
      .populate("classId", "name section academicYear");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    if (!student.classId || !student.section || !student.academicYear) {
      return res.status(200).json({
        success: true,
        data: {
          items: [],
          groupedByDay: emptyGroupedByDay(),
          meta: {
            student: { _id: student._id, name: student.userId?.name || null },
          },
        },
      });
    }

    const result = await scheduleService.getSchedulesUiReady({
      classId: student.classId._id,
      section: student.section,
      academicYear: student.academicYear,
      ...(req.query.dayOfWeek ? { dayOfWeek: req.query.dayOfWeek } : {}),
    });

    return res.status(200).json({
      success: true,
      data: {
        ...result,
        meta: {
          student: { _id: student._id, name: student.userId?.name || null },
          class: student.classId
            ? {
                _id: student.classId._id,
                name: student.classId.name,
                section: student.section,
                academicYear: student.academicYear,
              }
            : null,
        },
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch student schedule",
    });
  }
};

/**
 * Parent: fetch schedules for each linked child
 * @route GET /api/schedules/parent
 */
export const getParentSchedulesForMe = async (req, res) => {
  try {
    const parentProfileId = req.user.profileId;
    if (!parentProfileId) {
      return res.status(400).json({
        success: false,
        message: "Parent profileId missing on user",
      });
    }

    const parent = await Parent.findById(parentProfileId).populate({
      path: "children",
      populate: [
        { path: "userId", select: "name" },
        { path: "classId", select: "name section academicYear" },
      ],
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent profile not found",
      });
    }

    const children = parent.children || [];
    const childrenSchedules = [];

    for (const child of children) {
      if (!child?.classId || !child?.section || !child?.academicYear) {
        childrenSchedules.push({
          student: {
            _id: child?._id,
            name: child?.userId?.name || null,
            classId: child?.classId?._id || null,
            className: child?.classId?.name || null,
            section: child?.section || null,
            academicYear: child?.academicYear || null,
          },
          items: [],
          groupedByDay: emptyGroupedByDay(),
        });
        continue;
      }

      const result = await scheduleService.getSchedulesUiReady({
        classId: child.classId._id,
        section: child.section,
        academicYear: child.academicYear,
        ...(req.query.dayOfWeek ? { dayOfWeek: req.query.dayOfWeek } : {}),
      });

      childrenSchedules.push({
        student: {
          _id: child._id,
          name: child.userId?.name || null,
          classId: child.classId._id,
          className: child.classId?.name || null,
          section: child.section,
          academicYear: child.academicYear,
        },
        ...result,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        children: childrenSchedules,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch parent schedules",
    });
  }
};

/**
 * Get a single schedule by ID
 * @route GET /api/schedules/:id
 * @access All authenticated users
 */
export const getScheduleById = async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Invalid schedule ID format",
      });
    }

    const schedule = await scheduleService.getScheduleById(req.params.id);

    res.status(200).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch schedule",
    });
  }
};

/**
 * Update a schedule
 * @route PUT /api/schedules/:id
 * @access Admin only
 */
export const updateSchedule = async (req, res) => {
  try {
    const schedule = await scheduleService.updateSchedule(
      req.params.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      data: schedule,
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
        conflicts: error.conflicts,
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update schedule",
    });
  }
};

/**
 * Delete a schedule
 * @route DELETE /api/schedules/:id
 * @access Admin only
 */
export const deleteSchedule = async (req, res) => {
  try {
    const result = await scheduleService.deleteSchedule(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete schedule",
    });
  }
};

/**
 * Get weekly schedule for a class
 * @route GET /api/schedules/class/:classId/section/:section
 * @access All authenticated users
 */
export const getWeeklyScheduleForClass = async (req, res) => {
  try {
    const { classId, section } = req.params;
    const academicYear =
      req.query.academicYear ||
      new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);

    const weeklySchedule = await scheduleService.getWeeklyScheduleForClass(
      classId,
      section,
      academicYear,
    );

    res.status(200).json({
      success: true,
      data: weeklySchedule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch weekly schedule",
    });
  }
};

/**
 * Get weekly schedule for a teacher
 * @route GET /api/schedules/teacher/:teacherId
 * @access Teachers and Admin
 */
export const getWeeklyScheduleForTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const academicYear =
      req.query.academicYear ||
      new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);

    // Only allow teachers to view their own schedule (unless admin)
    if (req.user.role === "teacher") {
      const teacherProfileId = req.user.profileId;
      if (!teacherProfileId || teacherProfileId.toString() !== teacherId) {
        return res.status(403).json({
          success: false,
          message: "You can only view your own schedule",
        });
      }
    }

    const weeklySchedule = await scheduleService.getWeeklyScheduleForTeacher(
      teacherId,
      academicYear,
    );

    res.status(200).json({
      success: true,
      data: weeklySchedule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch weekly schedule",
    });
  }
};

/**
 * Get authenticated teacher's own schedule (no teacherId required)
 * @route GET /api/teacher/schedule
 * @access Teachers only
 */
export const getTeacherSchedule = async (req, res) => {
  try {
    // Get teacher profile from profileId (strict flow)
    const teacher = req.user.profileId
      ? await Teacher.findById(req.user.profileId)
      : null;
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found",
      });
    }

    const teacherId = teacher._id;
    // Only use academicYear if explicitly provided in query params
    // Otherwise, fetch schedules for all academic years
    const academicYear = req.query.academicYear || null;

    const weeklySchedule = await scheduleService.getWeeklyScheduleForTeacher(
      teacherId,
      academicYear,
    );

    res.status(200).json({
      success: true,
      data: weeklySchedule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch weekly schedule",
    });
  }
};
