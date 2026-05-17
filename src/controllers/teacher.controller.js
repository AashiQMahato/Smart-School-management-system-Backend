import Class from "../models/class.model.js";
import Student from "../models/student.model.js";
import Teacher from "../models/teacher.model.js";
import Schedule from "../models/schedule.model.js";
import mongoose from "mongoose";

class TeacherController {
  /**
   * Get current teacher's assigned classes and subjects
   * Uses req.user.profileId (Teacher profile id)
   */
  async getMyAssignments(req, res) {
    try {
      const teacherProfileId = req.user?.profileId;

      if (!teacherProfileId) {
        return res.status(400).json({
          success: false,
          message: "Teacher profile not linked to this user",
        });
      }

      const teacher = await Teacher.findById(teacherProfileId)
        .populate("userId", "name email phone")
        .populate("assignedClasses", "name section academicYear")
        .populate("assignedSubjects", "name classId classIds");

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Classes where teacher is set as classTeacher (some older data may store userId)
      const classTeacherOf = await Class.find({
        $or: [
          { classTeacher: teacherProfileId },
          { classTeacher: teacher.userId?._id },
        ].filter((q) => q.classTeacher),
      }).select("name section academicYear");

      // Schedule is the source of truth for class+subject teaching assignments
      // Treat legacy schedules missing `isActive` as active.
      const schedules = await Schedule.find({
        teacherId: teacher._id,
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      })
        .populate("classId", "name section academicYear")
        .populate("subjectId", "name")
        .select("classId subjectId")
        .lean();

      const assignedSubjectPairs = schedules
        .filter((s) => s.classId && s.subjectId)
        .map((s) => ({
          classId: s.classId,
          subjectId: s.subjectId,
        }));

      const assignedClassesFromSchedule = [
        ...new Map(
          schedules
            .filter((s) => s.classId)
            .map((s) => [String(s.classId._id || s.classId), s.classId]),
        ).values(),
      ];

      const assignedSubjectsFromSchedule = [
        ...new Map(
          schedules
            .filter((s) => s.subjectId)
            .map((s) => [String(s.subjectId._id || s.subjectId), s.subjectId]),
        ).values(),
      ];

      const resolvedAssignedClasses =
        assignedClassesFromSchedule.length > 0
          ? assignedClassesFromSchedule
          : teacher.assignedClasses;

      let totalStudents = 0;
      if (resolvedAssignedClasses && resolvedAssignedClasses.length > 0) {
        const classIds = resolvedAssignedClasses.map((c) => c._id || c);
        totalStudents = await Student.countDocuments({
          classId: { $in: classIds },
          $or: [
            { enrollmentStatus: "active" },
            { enrollmentStatus: { $exists: false } },
            { enrollmentStatus: null },
            { enrollmentStatus: { $regex: /^active$/i } },
          ],
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          teacher: {
            id: teacher._id,
            userId: teacher.userId,
            employeeCode: teacher.employeeCode,
          },
          // Prefer schedule-derived assignments; fall back to teacher profile fields
          assignedClasses: resolvedAssignedClasses,
          assignedSubjects:
            assignedSubjectsFromSchedule.length > 0
              ? assignedSubjectsFromSchedule
              : teacher.assignedSubjects,
          classTeacherOf,
          assignedSubjectPairs,
          totalStudents,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching teacher assignments",
        error: error.message,
      });
    }
  }

  /**
   * Get students by class (Teacher-only)
   * GET /api/teachers/class/:classId/students?subjectId=<optional>
   */
  async getStudentsByClass(req, res) {
    try {
      const teacherProfileId = req.user?.profileId;
      const { classId } = req.params;
      const { subjectId } = req.query;

      if (!teacherProfileId) {
        return res.status(400).json({
          success: false,
          message: "Teacher profile not linked to this user",
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

      const teacher = await Teacher.findById(teacherProfileId)
        .select("_id userId assignedClasses assignedSubjects")
        .lean();

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found",
        });
      }

      // Class-teacher access (tolerate legacy where classTeacher stored userId)
      const cls = await Class.findById(classId).select("_id classTeacher");
      if (!cls) {
        return res.status(404).json({
          success: false,
          message: "Class not found",
        });
      }

      const classTeacherValue = cls.classTeacher
        ? String(cls.classTeacher)
        : null;
      const teacherProfileValue = String(teacher._id);
      const teacherUserValue = teacher.userId ? String(teacher.userId) : null;
      const isClassTeacher =
        !!classTeacherValue &&
        (classTeacherValue === teacherProfileValue ||
          (teacherUserValue && classTeacherValue === teacherUserValue));

      const isAssignedClass = Array.isArray(teacher.assignedClasses)
        ? teacher.assignedClasses.some((c) => String(c) === String(classId))
        : false;

      const isAssignedSubject = subjectId
        ? Array.isArray(teacher.assignedSubjects)
          ? teacher.assignedSubjects.some(
              (s) => String(s) === String(subjectId),
            )
          : false
        : true;

      const canAccessByManualAssignment = isAssignedClass && isAssignedSubject;

      // Schedule-based access (source of truth)
      let hasSchedule = false;
      if (!isClassTeacher && !canAccessByManualAssignment) {
        const scheduleQuery = {
          teacherId: teacher._id,
          classId,
          $or: [{ isActive: true }, { isActive: { $exists: false } }],
        };
        if (subjectId) scheduleQuery.subjectId = subjectId;

        hasSchedule = !!(await Schedule.findOne(scheduleQuery)
          .select("_id")
          .lean());
        if (!hasSchedule) {
          return res.status(403).json({
            success: false,
            message: "You are not assigned to this class/subject",
          });
        }
      }

      const students = await Student.find({
        classId,
        $or: [
          { enrollmentStatus: "active" },
          { enrollmentStatus: { $exists: false } },
          { enrollmentStatus: null },
          { enrollmentStatus: { $regex: /^active$/i } },
        ],
      })
        .populate("userId", "name email phone status")
        .sort({ rollNumber: 1 });

      return res.status(200).json({
        success: true,
        count: students.length,
        data: students,
      });
    } catch (error) {
      console.error("TeacherController.getStudentsByClass error:", {
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
  }
}

export default new TeacherController();
