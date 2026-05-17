import Student from "../models/student.model.js";
import Parent from "../models/parent.model.js";
import Teacher from "../models/teacher.model.js";
import Admin from "../models/admin.model.js";

/**
 * Get role profile for a user
 * Uses the User → profileId → Role Profile pattern
 */
export const getRoleProfile = async (user, populateOptions = {}) => {
  if (!user.profileId) {
    return null;
  }

  let roleProfile = null;

  switch (user.role) {
    case "student":
      roleProfile = await Student.findById(user.profileId)
        .populate(populateOptions.classId !== false ? "classId" : "")
        .populate(populateOptions.parentId !== false ? "parentId" : "");
      break;

    case "parent":
      roleProfile = await Parent.findById(user.profileId).populate(
        populateOptions.children !== false
          ? {
              path: "children",
              populate: [
                { path: "userId", select: "name email phone" },
                { path: "classId", select: "name section" },
              ],
            }
          : "",
      );
      break;

    case "teacher":
      roleProfile = await Teacher.findById(user.profileId)
        .populate(
          populateOptions.assignedClasses !== false ? "assignedClasses" : "",
        )
        .populate(
          populateOptions.assignedSubjects !== false ? "assignedSubjects" : "",
        );
      break;

    case "admin":
      roleProfile = await Admin.findById(user.profileId);
      break;
  }

  return roleProfile;
};

/**
 * Get profile ID directly from user
 * This is the primary access pattern: User.profileId
 */
export const getProfileId = (user) => {
  return user.profileId;
};

/**
 * Resolve a Teacher profile by either Teacher profile _id or the related User _id.
 * This helps endpoints accept payloads that may accidentally send a User id.
 */
export const resolveTeacherProfile = async (teacherIdOrUserId) => {
  if (!teacherIdOrUserId) {
    return null;
  }

  const teacher =
    (await Teacher.findById(teacherIdOrUserId)) ||
    (await Teacher.findOne({ userId: teacherIdOrUserId }));

  return teacher;
};

/**
 * Treat empty-string ObjectId inputs as "not provided".
 */
export const normalizeOptionalObjectId = (value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
};
