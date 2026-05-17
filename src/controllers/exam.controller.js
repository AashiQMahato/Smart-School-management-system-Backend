import examResultService from "../services/examResult.service.js";
import Student from "../models/student.model.js";
import Parent from "../models/parent.model.js";
import Teacher from "../models/teacher.model.js";

// ============ EXAM MANAGEMENT (Admin) ============

export const createExam = async (req, res) => {
  try {
    const exam = await examResultService.createExam({
      ...req.body,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: exam });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllExams = async (req, res) => {
  try {
    const exams = await examResultService.getAllExams(req.query);
    res.status(200).json({ success: true, count: exams.length, data: exams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getExamById = async (req, res) => {
  try {
    const exam = await examResultService.getExamById(req.params.id);
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    res.status(200).json({ success: true, data: exam });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateExam = async (req, res) => {
  try {
    const exam = await examResultService.updateExam(req.params.id, req.body);
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    res.status(200).json({ success: true, data: exam });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteExam = async (req, res) => {
  try {
    await examResultService.deleteExam(req.params.id);
    res
      .status(200)
      .json({ success: true, message: "Exam deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ EXAM SUBJECTS ============

export const addExamSubjects = async (req, res) => {
  try {
    const { subjects } = req.body;
    if (!subjects || !subjects.length) {
      return res
        .status(400)
        .json({ success: false, message: "Subjects array required" });
    }
    const data = await examResultService.addExamSubjects(
      req.params.examId,
      subjects,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getExamSubjects = async (req, res) => {
  try {
    const teacherId =
      req.user?.role === "teacher" && req.user.profileId
        ? req.user.profileId
        : null;
    const data = await examResultService.getExamSubjects(
      req.params.examId,
      req.query.classId,
      teacherId,
    );
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateExamSubject = async (req, res) => {
  try {
    const data = await examResultService.updateExamSubject(
      req.params.id,
      req.body,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ MARKS ENTRY (Teacher) ============

export const enterMarks = async (req, res) => {
  try {
    const { examSubjectId, marks } = req.body;
    if (!marks || !marks.length) {
      return res
        .status(400)
        .json({ success: false, message: "Marks array required" });
    }

    let teacherId = null;
    if (req.user.role === "teacher" && req.user.profileId) {
      teacherId = req.user.profileId;
    }

    const data = await examResultService.enterMarks(
      req.params.examId,
      examSubjectId,
      marks,
      teacherId,
    );

    res.status(200).json({
      success: true,
      message: `Saved ${data.results.length} marks`,
      data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitMarks = async (req, res) => {
  try {
    let teacherId = null;
    if (req.user.role === "teacher" && req.user.profileId) {
      teacherId = req.user.profileId;
    }
    const data = await examResultService.submitMarksForApproval(
      req.params.examSubjectId,
      teacherId,
    );
    res
      .status(200)
      .json({ success: true, message: "Marks submitted for approval", data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ APPROVAL (Admin) ============

export const getApprovalQueue = async (req, res) => {
  try {
    const data = await examResultService.getApprovalQueue();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveMarks = async (req, res) => {
  try {
    const data = await examResultService.approveMarks(
      req.params.examSubjectId,
      req.user._id,
    );
    res.status(200).json({ success: true, message: "Marks approved", data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectMarks = async (req, res) => {
  try {
    const data = await examResultService.rejectMarks(req.params.examSubjectId);
    res.status(200).json({ success: true, message: "Marks rejected", data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ PUBLISH / UNPUBLISH (Admin) ============

export const publishExamResults = async (req, res) => {
  try {
    const { classId } = req.body;
    const result = await examResultService.publishExamResults(
      req.params.examId,
      classId,
    );
    res.status(200).json({
      success: true,
      message: `Published ${result.modifiedCount} results`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unpublishExamResults = async (req, res) => {
  try {
    const { classId } = req.body;
    const result = await examResultService.unpublishExamResults(
      req.params.examId,
      classId,
    );
    res.status(200).json({
      success: true,
      message: `Unpublished ${result.modifiedCount} results`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ RESULTS VIEW ============

export const getExamResults = async (req, res) => {
  try {
    const data = await examResultService.getExamResults(
      req.params.examId,
      req.query.classId,
      req.query.subjectId,
    );
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getClassAnalytics = async (req, res) => {
  try {
    const data = await examResultService.getClassAnalytics(
      req.params.examId,
      req.params.classId,
    );
    if (!data) {
      return res.status(200).json({
        success: true,
        data: {
          overview: {
            totalStudents: 0,
            overallAverage: "0",
            highestPercentage: "0",
            lowestPercentage: "0",
            passCount: 0,
            failCount: 0,
          },
          subjectAnalytics: [],
          studentRanking: [],
        },
        message: "No results found for this exam and class yet",
      });
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ STUDENT / PARENT VIEW ============

export const getMyExamResults = async (req, res) => {
  try {
    if (!req.user.profileId) {
      return res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
    }
    const data = await examResultService.getStudentExamResults(
      req.user.profileId,
      req.query.examId,
    );
    const publishedOnly = data.filter((r) => r.isPublished);
    res.status(200).json({
      success: true,
      count: publishedOnly.length,
      data: publishedOnly,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getChildExamResults = async (req, res) => {
  try {
    const parent = await Parent.findById(req.user.profileId);
    if (
      !parent ||
      !parent.children.some((c) => c.toString() === req.params.studentId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only view your children's results",
      });
    }
    const data = await examResultService.getStudentExamResults(
      req.params.studentId,
      req.query.examId,
    );
    const publishedOnly = data.filter((r) => r.isPublished);
    res.status(200).json({
      success: true,
      count: publishedOnly.length,
      data: publishedOnly,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ REPORT CARD ============

export const getReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { examId } = req.query;

    if (req.user.role === "student") {
      if (!req.user.profileId || req.user.profileId.toString() !== studentId) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }
    } else if (req.user.role === "parent") {
      const parent = await Parent.findById(req.user.profileId);
      if (!parent || !parent.children.some((c) => c.toString() === studentId)) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }
    }

    const data = await examResultService.getReportCardData(studentId, examId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ TEACHER: assigned exams ============

export const getTeacherExams = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.profileId);
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: "Teacher profile not found" });
    }

    // Prefer schedule-derived classes; fall back to teacher.assignedClasses
    const Schedule = (await import("../models/schedule.model.js")).default;
    const schedules = await Schedule.find({
      teacherId: teacher._id,
      isActive: true,
    })
      .select("classId")
      .lean();

    const classIdsFromSchedule = [
      ...new Set(schedules.map((s) => String(s.classId)).filter(Boolean)),
    ];

    const classIds =
      classIdsFromSchedule.length > 0
        ? classIdsFromSchedule
        : (teacher.assignedClasses || []).map((id) => String(id));

    const exams = await examResultService.getAllExams();
    const filtered = exams.filter((e) =>
      e.classes.some((c) =>
        classIds.some((tc) => tc.toString() === c._id.toString()),
      ),
    );
    res
      .status(200)
      .json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ ADMIN OVERVIEW ============

export const getAdminOverview = async (req, res) => {
  try {
    const data = await examResultService.getAdminOverview();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ STUDENT PUBLISHED EXAMS ============

export const getStudentPublishedExams = async (req, res) => {
  try {
    if (!req.user.profileId) {
      return res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
    }
    const data = await examResultService.getStudentPublishedExams(
      req.user.profileId,
    );
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ PARENT: CHILD PUBLISHED EXAMS ============

export const getChildPublishedExams = async (req, res) => {
  try {
    const parent = await Parent.findById(req.user.profileId);
    if (
      !parent ||
      !parent.children.some((c) => c.toString() === req.params.studentId)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    const data = await examResultService.getStudentPublishedExams(
      req.params.studentId,
    );
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
