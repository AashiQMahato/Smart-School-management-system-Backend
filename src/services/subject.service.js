import Subject from "../models/subject.model.js";
import Teacher from "../models/teacher.model.js";
import Class from "../models/class.model.js";
import {
  normalizeOptionalObjectId,
  resolveTeacherProfile,
} from "../utils/profileHelper.js";

class SubjectService {
  normalizeObjectIdArray(values) {
    if (!Array.isArray(values)) return undefined;
    const normalized = values
      .map((v) => normalizeOptionalObjectId(v))
      .filter(Boolean)
      .map((v) => String(v));
    return [...new Set(normalized)];
  }

  async validateClassesExist(classIds) {
    if (!classIds || classIds.length === 0) return;
    const found = await Class.countDocuments({ _id: { $in: classIds } });
    if (found !== classIds.length) {
      throw new Error("One or more classes not found");
    }
  }

  getSubjectClassIds(subjectDoc) {
    const legacy = subjectDoc?.classId ? [String(subjectDoc.classId)] : [];
    const multi = Array.isArray(subjectDoc?.classIds)
      ? subjectDoc.classIds.map((id) => String(id))
      : [];
    return [...new Set([...legacy, ...multi])];
  }

  // Create a new subject
  async createSubject(subjectData) {
    try {
      const data = { ...subjectData };

      // Normalize subject code
      if (data.code) {
        data.code = data.code.trim().toUpperCase();
      }

      // Normalize optional ObjectId inputs (avoid "Cast to ObjectId failed" when UI sends "")
      data.assignedTeacher = normalizeOptionalObjectId(data.assignedTeacher);
      data.classId = normalizeOptionalObjectId(data.classId);
      const normalizedClassIds = this.normalizeObjectIdArray(data.classIds);

      if (data.assignedTeacher === undefined) {
        delete data.assignedTeacher;
      }
      if (data.classId === undefined) {
        delete data.classId;
      }
      if (normalizedClassIds === undefined) {
        delete data.classIds;
      } else {
        data.classIds = normalizedClassIds;
      }

      // Check if subject code already exists (check both active and inactive)
      const existingSubject = await Subject.findOne({ code: data.code });
      if (existingSubject) {
        throw new Error("Subject with this code already exists");
      }

      // Validate teacher if provided
      if (data.assignedTeacher) {
        const teacher = await resolveTeacherProfile(data.assignedTeacher);
        if (!teacher) {
          throw new Error("Assigned teacher must be a valid teacher");
        }

        // Always store Teacher profile _id
        data.assignedTeacher = teacher._id;
      }

      // Validate class if provided
      // If classIds are provided, prefer them. Otherwise fall back to legacy classId.
      let classIdsToLink = [];
      if (Array.isArray(data.classIds) && data.classIds.length > 0) {
        classIdsToLink = data.classIds;
      } else if (data.classId) {
        classIdsToLink = [String(data.classId)];
        data.classIds = classIdsToLink;
      }

      await this.validateClassesExist(classIdsToLink);

      // Maintain legacy classId for backward compatibility:
      // - if exactly 1 class, set classId
      // - if multiple classes, set classId to null
      if (classIdsToLink.length === 1) {
        data.classId = classIdsToLink[0];
      } else if (classIdsToLink.length > 1) {
        data.classId = null;
      }

      const newSubject = await Subject.create(data);

      // If classIds are provided, add this subject to all those classes
      if (classIdsToLink.length > 0) {
        await Class.updateMany(
          { _id: { $in: classIdsToLink } },
          { $addToSet: { subjects: newSubject._id } },
        );
      }

      return await Subject.findById(newSubject._id)
        .populate({
          path: "assignedTeacher",
          select: "employeeCode qualification",
          populate: {
            path: "userId",
            select: "name email phone",
          },
        })
        .populate("classId", "name section")
        .populate("classIds", "name section");
    } catch (error) {
      throw error;
    }
  }

  // Get all subjects
  async getAllSubjects(filters = {}) {
    try {
      const query = {};

      // Only filter by isActive if explicitly provided, otherwise return all
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      } else {
        // Default: show only active subjects
        query.isActive = true;
      }

      if (filters.academicYear) {
        query.academicYear = filters.academicYear;
      }

      if (filters.classId) {
        query.$or = [
          { classId: filters.classId },
          { classIds: filters.classId },
        ];
      }

      if (filters.teacherId) {
        const teacher = await resolveTeacherProfile(filters.teacherId);
        query.assignedTeacher = teacher ? teacher._id : filters.teacherId;
      }

      // If showAll flag is passed, remove the isActive filter to get all subjects
      if (filters.showAll === true || filters.showAll === "true") {
        delete query.isActive;
      }

      const subjects = await Subject.find(query)
        .populate({
          path: "assignedTeacher",
          select: "employeeCode qualification",
          populate: {
            path: "userId",
            select: "name email phone",
          },
        })
        .populate("classId", "name section")
        .populate("classIds", "name section")
        .sort({ name: 1 });

      return subjects;
    } catch (error) {
      throw error;
    }
  }

  // Get subject by ID
  async getSubjectById(subjectId) {
    try {
      const subject = await Subject.findById(subjectId)
        .populate({
          path: "assignedTeacher",
          select: "employeeCode qualification",
          populate: {
            path: "userId",
            select: "name email phone",
          },
        })
        .populate("classId", "name section academicYear")
        .populate("classIds", "name section academicYear");

      if (!subject) {
        throw new Error("Subject not found");
      }

      return subject;
    } catch (error) {
      throw error;
    }
  }

  // Update subject
  async updateSubject(subjectId, updateData) {
    try {
      const data = { ...updateData };

      data.assignedTeacher = normalizeOptionalObjectId(data.assignedTeacher);
      data.classId = normalizeOptionalObjectId(data.classId);
      const normalizedClassIds = this.normalizeObjectIdArray(data.classIds);

      if (data.assignedTeacher === undefined) {
        delete data.assignedTeacher;
      }
      if (data.classId === undefined) {
        delete data.classId;
      }
      if (normalizedClassIds === undefined) {
        delete data.classIds;
      } else {
        data.classIds = normalizedClassIds;
      }

      // Validate teacher if being updated
      if (data.assignedTeacher) {
        const teacher = await resolveTeacherProfile(data.assignedTeacher);
        if (!teacher) {
          throw new Error("Assigned teacher must be a valid teacher");
        }

        data.assignedTeacher = teacher._id;
      }

      const currentSubject = await Subject.findById(subjectId);
      if (!currentSubject) {
        throw new Error("Subject not found");
      }

      const classIdsExplicitlyProvided =
        Object.prototype.hasOwnProperty.call(updateData, "classIds") ||
        Object.prototype.hasOwnProperty.call(updateData, "classId");

      let nextClassIds;
      if (classIdsExplicitlyProvided) {
        if (Array.isArray(updateData.classIds)) {
          nextClassIds = normalizedClassIds || [];
        } else if (updateData.classId === null) {
          nextClassIds = [];
        } else if (data.classId) {
          nextClassIds = [String(data.classId)];
        } else {
          nextClassIds = [];
        }

        await this.validateClassesExist(nextClassIds);

        const currentClassIds = this.getSubjectClassIds(currentSubject);

        const toRemove = currentClassIds.filter(
          (id) => !nextClassIds.includes(id),
        );
        const toAdd = nextClassIds.filter(
          (id) => !currentClassIds.includes(id),
        );

        if (toRemove.length > 0) {
          await Class.updateMany(
            { _id: { $in: toRemove } },
            { $pull: { subjects: subjectId } },
          );
        }

        if (toAdd.length > 0) {
          await Class.updateMany(
            { _id: { $in: toAdd } },
            { $addToSet: { subjects: subjectId } },
          );
        }

        data.classIds = nextClassIds;
        data.classId = nextClassIds.length === 1 ? nextClassIds[0] : null;
      }

      // Normalize and check for duplicate code if being updated
      if (data.code) {
        data.code = data.code.trim().toUpperCase();

        const duplicate = await Subject.findOne({
          code: data.code,
          _id: { $ne: subjectId },
        });

        if (duplicate) {
          throw new Error("Another subject with this code already exists");
        }
      }

      const updatedSubject = await Subject.findByIdAndUpdate(subjectId, data, {
        new: true,
        runValidators: true,
      })
        .populate({
          path: "assignedTeacher",
          select: "employeeCode qualification",
          populate: {
            path: "userId",
            select: "name email phone",
          },
        })
        .populate("classId", "name section")
        .populate("classIds", "name section");

      return updatedSubject;
    } catch (error) {
      throw error;
    }
  }

  // Delete subject
  // Delete subject (HARD delete)
  async deleteSubject(subjectId) {
    try {
      const subject = await Subject.findById(subjectId);
      if (!subject) {
        throw new Error("Subject not found");
      }

      // Remove subject from all linked classes
      const classIds = this.getSubjectClassIds(subject);
      if (classIds.length > 0) {
        await Class.updateMany(
          { _id: { $in: classIds } },
          { $pull: { subjects: subjectId } },
        );
      }

      // 🔥 Permanently delete
      await Subject.findByIdAndDelete(subjectId);

      return { message: "Subject permanently deleted" };
    } catch (error) {
      console.error(`❌ Error deleting subject: ${error.message}`);
      throw error;
    }
  }

  // Assign teacher to subject
  async assignTeacher(subjectId, teacherId) {
    try {
      if (!teacherId) {
        throw new Error("Must assign a valid teacher");
      }

      // Validate teacher
      const teacher = await resolveTeacherProfile(teacherId);
      if (!teacher) {
        throw new Error("Must assign a valid teacher");
      }

      const updatedSubject = await Subject.findByIdAndUpdate(
        subjectId,
        { assignedTeacher: teacher._id },
        { new: true },
      ).populate({
        path: "assignedTeacher",
        select: "employeeCode qualification",
        populate: {
          path: "userId",
          select: "name email phone",
        },
      });

      if (!updatedSubject) {
        throw new Error("Subject not found");
      }

      return updatedSubject;
    } catch (error) {
      throw error;
    }
  }
}

export default new SubjectService();
