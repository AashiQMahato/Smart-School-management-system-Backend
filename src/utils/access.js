import mongoose from "mongoose";
import Class from "../models/class.model.js";
import Parent from "../models/parent.model.js";
import Schedule from "../models/schedule.model.js";
import Student from "../models/student.model.js";
import Teacher from "../models/teacher.model.js";

/**
 * Object-level access helpers shared by controllers.
 * Mirrors the teacher/class rules used by TeacherController.getStudentsByClass:
 * a teacher can access a class when they are its class teacher, are manually
 * assigned to it (and to the subject when one is given), or have an active
 * schedule entry for it.
 */

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

export const isTeacherOfClass = async (user, classId, subjectId = null) => {
  if (!user?.profileId || !mongoose.isValidObjectId(classId)) return false;
  if (subjectId && !mongoose.isValidObjectId(subjectId)) return false;

  const teacher = await Teacher.findById(user.profileId)
    .select("_id userId assignedClasses assignedSubjects")
    .lean();
  if (!teacher) return false;

  const cls = await Class.findById(classId).select("classTeacher").lean();
  if (!cls) return false;

  // Tolerate legacy data where classTeacher stores the teacher's userId
  if (
    sameId(cls.classTeacher, teacher._id) ||
    sameId(cls.classTeacher, teacher.userId)
  ) {
    return true;
  }

  const isAssignedClass = (teacher.assignedClasses || []).some((c) =>
    sameId(c, classId),
  );
  const isAssignedSubject = subjectId
    ? (teacher.assignedSubjects || []).some((s) => sameId(s, subjectId))
    : true;
  if (isAssignedClass && isAssignedSubject) return true;

  const scheduleQuery = {
    teacherId: teacher._id,
    classId,
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  };
  if (subjectId) scheduleQuery.subjectId = subjectId;

  return !!(await Schedule.exists(scheduleQuery));
};

export const isParentOfStudent = async (user, studentId) => {
  if (!user?.profileId || !mongoose.isValidObjectId(studentId)) return false;
  return !!(await Parent.exists({ _id: user.profileId, children: studentId }));
};

/**
 * Can `user` read data belonging to the given Student profile?
 * admin: any; student: self; parent: linked children; teacher: students in a
 * class they teach.
 */
export const canAccessStudent = async (user, studentId) => {
  if (!user || !mongoose.isValidObjectId(studentId)) return false;

  switch (user.role) {
    case "admin":
      return true;
    case "student":
      return sameId(user.profileId, studentId);
    case "parent":
      return isParentOfStudent(user, studentId);
    case "teacher": {
      const student = await Student.findById(studentId).select("classId").lean();
      return !!student?.classId && isTeacherOfClass(user, student.classId);
    }
    default:
      return false;
  }
};
