import Result from "../models/result.model.js";
import Student from "../models/student.model.js";
import Subject from "../models/subject.model.js";
import { canAccessStudent, isTeacherOfClass } from "../utils/access.js";

const forbidden = (res, message) =>
  res.status(403).json({ success: false, message });

/**
 * Create a new result entry
 * @route POST /api/results
 * @access Admin, Teacher
 */
export const createResult = async (req, res) => {
  try {
    const {
      studentId,
      subjectId,
      classId,
      examType,
      marksObtained,
      maxMarks,
      academicYear,
      remarks,
    } = req.body;

    // Validate student
    if (!studentId || !subjectId) {
      return res.status(400).json({
        success: false,
        message: "studentId and subjectId are required",
      });
    }
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Validate subject
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const targetClassId = classId || student.classId;

    // Teachers may only enter results for students of a class/subject they teach
    if (req.user.role === "teacher") {
      if (
        String(student.classId) !== String(targetClassId) ||
        !(await isTeacherOfClass(req.user, targetClassId, subjectId))
      ) {
        return forbidden(
          res,
          "You can only enter results for classes and subjects you teach",
        );
      }
    }

    // Get teacher profile for enteredBy
    let enteredById = null;
    if (req.user.role === "teacher" && req.user.profileId) {
      enteredById = req.user.profileId;
    }

    // Check for duplicate result
    const existingResult = await Result.findOne({
      studentId,
      subjectId,
      classId: classId || student.classId,
      examType,
      academicYear: academicYear || student.academicYear,
    });

    if (existingResult) {
      return res.status(409).json({
        success: false,
        message:
          "Result already exists for this student, subject, and exam type",
      });
    }

    const result = await Result.create({
      studentId,
      subjectId,
      classId: classId || student.classId,
      examType,
      marksObtained,
      maxMarks,
      academicYear: academicYear || student.academicYear,
      enteredBy: enteredById,
      remarks,
    });

    const populatedResult = await Result.findById(result._id)
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber section",
        populate: {
          path: "userId",
          select: "name email",
        },
      })
      .populate("subjectId", "name code")
      .populate("classId", "name section")
      .populate({
        path: "enteredBy",
        select: "employeeCode",
        populate: {
          path: "userId",
          select: "name",
        },
      });

    res.status(201).json({
      success: true,
      message: "Result created successfully",
      data: populatedResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create result",
    });
  }
};

/**
 * Create bulk results
 * @route POST /api/results/bulk
 * @access Admin, Teacher
 */
export const createBulkResults = async (req, res) => {
  try {
    const { results, examType, subjectId, classId, academicYear, maxMarks } =
      req.body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Results array is required",
      });
    }

    if (!classId || !subjectId) {
      return res.status(400).json({
        success: false,
        message: "classId and subjectId are required",
      });
    }

    if (
      req.user.role === "teacher" &&
      !(await isTeacherOfClass(req.user, classId, subjectId))
    ) {
      return forbidden(
        res,
        "You can only enter results for classes and subjects you teach",
      );
    }

    // Only students enrolled in the class can receive results
    const classStudentIds = new Set(
      (await Student.find({ classId }).select("_id").lean()).map((st) =>
        String(st._id),
      ),
    );

    // Get teacher profile for enteredBy
    let enteredById = null;
    if (req.user.role === "teacher" && req.user.profileId) {
      enteredById = req.user.profileId;
    }

    const createdResults = [];
    const errors = [];

    for (const result of results) {
      try {
        if (!classStudentIds.has(String(result?.studentId))) {
          errors.push({
            studentId: result?.studentId,
            message: "Student is not in this class",
          });
          continue;
        }

        // Check for duplicate
        const existing = await Result.findOne({
          studentId: result.studentId,
          subjectId,
          classId,
          examType,
          academicYear,
        });

        if (existing) {
          errors.push({
            studentId: result.studentId,
            message: "Result already exists",
          });
          continue;
        }

        const newResult = await Result.create({
          studentId: result.studentId,
          subjectId,
          classId,
          examType,
          marksObtained: result.marksObtained,
          maxMarks,
          academicYear,
          enteredBy: enteredById,
          remarks: result.remarks,
        });

        createdResults.push(newResult);
      } catch (err) {
        errors.push({
          studentId: result.studentId,
          message: err.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdResults.length} results`,
      data: {
        created: createdResults.length,
        errors: errors.length,
        errorDetails: errors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create bulk results",
    });
  }
};

/**
 * Get results by class
 * @route GET /api/results/class/:classId
 * @access Admin, Teacher
 */
export const getResultsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { examType, subjectId, academicYear, isPublished } = req.query;

    if (
      req.user.role === "teacher" &&
      !(await isTeacherOfClass(req.user, classId))
    ) {
      return forbidden(res, "You can only view results for classes you teach");
    }

    const query = { classId };
    if (examType) query.examType = examType;
    if (subjectId) query.subjectId = subjectId;
    if (academicYear) query.academicYear = academicYear;
    if (isPublished !== undefined) query.isPublished = isPublished === "true";

    const results = await Result.find(query)
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber section",
        populate: {
          path: "userId",
          select: "name email",
        },
      })
      .populate("subjectId", "name code")
      .populate("classId", "name section")
      .sort({ "studentId.rollNumber": 1 });

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch results",
    });
  }
};

/**
 * Get results by student
 * @route GET /api/results/student/:studentId
 * @access Admin, Teacher, Student (own), Parent (children)
 */
export const getResultsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { examType, subjectId, academicYear, isPublished } = req.query;

    // Authorization check (student: own, parent: children, teacher: own classes)
    if (!(await canAccessStudent(req.user, studentId))) {
      const message =
        req.user.role === "student"
          ? "You can only view your own results"
          : req.user.role === "parent"
            ? "You can only view your children's results"
            : "You can only view results for students you teach";
      return forbidden(res, message);
    }

    const query = { studentId };
    if (examType) query.examType = examType;
    if (subjectId) query.subjectId = subjectId;
    if (academicYear) query.academicYear = academicYear;

    // Students and parents can only see published results
    if (req.user.role === "student" || req.user.role === "parent") {
      query.isPublished = true;
    } else if (isPublished !== undefined) {
      query.isPublished = isPublished === "true";
    }

    const results = await Result.find(query)
      .populate("subjectId", "name code")
      .populate("classId", "name section")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch results",
    });
  }
};

/**
 * Get my results (for logged-in student)
 * @route GET /api/results/my
 * @access Student
 */
export const getMyResults = async (req, res) => {
  try {
    if (!req.user.profileId) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const { examType, subjectId, academicYear } = req.query;

    const query = { studentId: req.user.profileId, isPublished: true };
    if (examType) query.examType = examType;
    if (subjectId) query.subjectId = subjectId;
    if (academicYear) query.academicYear = academicYear;

    const results = await Result.find(query)
      .populate("subjectId", "name code")
      .populate("classId", "name section")
      .sort({ createdAt: -1 });

    // Calculate summary
    const summary = {
      totalSubjects: new Set(results.map((r) => r.subjectId?._id?.toString()))
        .size,
      averagePercentage:
        results.length > 0
          ? (
              results.reduce((sum, r) => sum + r.percentage, 0) / results.length
            ).toFixed(2)
          : 0,
    };

    res.status(200).json({
      success: true,
      count: results.length,
      summary,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch results",
    });
  }
};

/**
 * Update a result
 * @route PUT /api/results/:id
 * @access Admin, Teacher
 */
export const updateResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { marksObtained, maxMarks, remarks } = req.body;

    const result = await Result.findById(id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Result not found",
      });
    }

    if (req.user.role === "teacher") {
      if (
        !(await isTeacherOfClass(req.user, result.classId, result.subjectId))
      ) {
        return forbidden(
          res,
          "You can only update results for classes and subjects you teach",
        );
      }
      if (result.isPublished) {
        return res.status(400).json({
          success: false,
          message: "Result is published and cannot be edited",
        });
      }
    }

    // Update fields
    if (marksObtained !== undefined) result.marksObtained = marksObtained;
    if (maxMarks !== undefined) result.maxMarks = maxMarks;
    if (remarks !== undefined) result.remarks = remarks;

    await result.save();

    const populatedResult = await Result.findById(id)
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber section",
        populate: {
          path: "userId",
          select: "name email",
        },
      })
      .populate("subjectId", "name code")
      .populate("classId", "name section");

    res.status(200).json({
      success: true,
      message: "Result updated successfully",
      data: populatedResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update result",
    });
  }
};

/**
 * Publish results
 * @route POST /api/results/publish
 * @access Admin
 */
export const publishResults = async (req, res) => {
  try {
    const { classId, examType, subjectId, academicYear } = req.body;

    const query = {};
    if (classId) query.classId = classId;
    if (examType) query.examType = examType;
    if (subjectId) query.subjectId = subjectId;
    if (academicYear) query.academicYear = academicYear;

    const updateResult = await Result.updateMany(query, { isPublished: true });

    res.status(200).json({
      success: true,
      message: `Published ${updateResult.modifiedCount} results`,
      data: {
        modifiedCount: updateResult.modifiedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to publish results",
    });
  }
};

/**
 * Delete a result
 * @route DELETE /api/results/:id
 * @access Admin
 */
export const deleteResult = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await Result.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Result not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Result deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete result",
    });
  }
};
