import Result from "../models/result.model.js";
import Student from "../models/student.model.js";
import Teacher from "../models/teacher.model.js";
import Parent from "../models/parent.model.js";
import Subject from "../models/subject.model.js";
import Class from "../models/class.model.js";

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

    // Get teacher profile for enteredBy
    let enteredById = null;
    if (req.user.role === "teacher" && req.user.profileId) {
      enteredById = req.user.profileId;
    }

    const createdResults = [];
    const errors = [];

    for (const result of results) {
      try {
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

    // Authorization check
    if (req.user.role === "student") {
      if (!req.user.profileId || req.user.profileId.toString() !== studentId) {
        return res.status(403).json({
          success: false,
          message: "You can only view your own results",
        });
      }
    } else if (req.user.role === "parent") {
      const parent = await Parent.findById(req.user.profileId);
      if (!parent || !parent.children.some((c) => c.toString() === studentId)) {
        return res.status(403).json({
          success: false,
          message: "You can only view your children's results",
        });
      }
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
