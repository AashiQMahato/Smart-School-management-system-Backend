import Exam from "../models/exam.model.js";
import ExamSubject from "../models/examSubject.model.js";
import Result from "../models/result.model.js";
import Student from "../models/student.model.js";
import Subject from "../models/subject.model.js";
import Class from "../models/class.model.js";
import Schedule from "../models/schedule.model.js";

class ExamResultService {
  async createExam(data) {
    const exam = await Exam.create(data);
    return Exam.findById(exam._id)
      .populate("classes", "name section academicYear")
      .populate("createdBy", "name");
  }

  async getAllExams(filters = {}) {
    const query = {};
    if (filters.academicYear) query.academicYear = filters.academicYear;
    if (filters.examType) query.examType = filters.examType;
    if (filters.status) query.status = filters.status;
    if (filters.classId) query.classes = filters.classId;

    return Exam.find(query)
      .populate("classes", "name section academicYear")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });
  }

  async getExamById(id) {
    return Exam.findById(id)
      .populate("classes", "name section academicYear")
      .populate("createdBy", "name");
  }

  async updateExam(id, data) {
    const existing = await Exam.findById(id).select("isPublished");
    if (!existing) throw new Error("Exam not found");
    if (existing.isPublished) {
      throw new Error(
        "Exam is published. Results are locked and cannot be edited",
      );
    }

    const exam = await Exam.findByIdAndUpdate(id, data, { new: true })
      .populate("classes", "name section academicYear")
      .populate("createdBy", "name");
    return exam;
  }

  async deleteExam(id) {
    const existing = await Exam.findById(id).select("isPublished");
    if (!existing) throw new Error("Exam not found");
    if (existing.isPublished) {
      throw new Error(
        "Exam is published. Results are locked and cannot be deleted",
      );
    }
    await ExamSubject.deleteMany({ examId: id });
    await Result.deleteMany({ examId: id });
    return Exam.findByIdAndDelete(id);
  }

  async addExamSubjects(examId, subjects) {
    const exam = await Exam.findById(examId).select("isPublished");
    if (!exam) throw new Error("Exam not found");
    if (exam.isPublished) {
      throw new Error("Exam is published. Subjects cannot be modified");
    }
    const created = [];
    for (const sub of subjects) {
      const es = await ExamSubject.create({ examId, ...sub });
      created.push(es);
    }
    return ExamSubject.find({ examId })
      .populate("subjectId", "name code")
      .populate("classId", "name section");
  }

  async getExamSubjects(examId, classId, teacherId = null) {
    const query = { examId };
    if (classId) query.classId = classId;

    // Teacher should only see subjects they actually teach in that class.
    if (teacherId) {
      const scheduleQuery = { teacherId, isActive: true };
      if (classId) scheduleQuery.classId = classId;

      const schedules = await Schedule.find(scheduleQuery)
        .select("classId subjectId")
        .lean();

      const pairs = schedules
        .filter((s) => s.classId && s.subjectId)
        .map((s) => ({ classId: s.classId, subjectId: s.subjectId }));

      if (!pairs.length) {
        return [];
      }

      query.$or = pairs;
    }

    return ExamSubject.find(query)
      .populate("subjectId", "name code")
      .populate("classId", "name section")
      .populate({
        path: "submittedBy",
        select: "employeeCode",
        populate: { path: "userId", select: "name" },
      });
  }

  async updateExamSubject(id, data) {
    return ExamSubject.findByIdAndUpdate(id, data, { new: true })
      .populate("subjectId", "name code")
      .populate("classId", "name section");
  }

  async enterMarks(examId, examSubjectId, marks, teacherId) {
    const examSubject = await ExamSubject.findById(examSubjectId);
    if (!examSubject) throw new Error("Exam subject not found");

    const exam = await Exam.findById(examId).select(
      "_id name examType academicYear isPublished",
    );
    if (!exam) throw new Error("Exam not found");
    if (exam.isPublished) {
      throw new Error(
        "Exam is published. Results are locked and cannot be edited",
      );
    }

    // If a teacher is submitting, ensure they are assigned to this class+subject
    if (teacherId) {
      const schedule = await Schedule.findOne({
        teacherId,
        classId: examSubject.classId,
        subjectId: examSubject.subjectId,
        isActive: true,
      }).select("_id");

      if (!schedule) {
        throw new Error(
          "You are not assigned to teach this subject in this class",
        );
      }
    }

    if (examSubject.marksEntryStatus === "approved") {
      throw new Error("Marks already approved, cannot modify");
    }
    if (examSubject.marksEntryStatus === "submitted") {
      throw new Error(
        "Marks already submitted. Wait for admin approval/rejection",
      );
    }

    const results = [];
    const errors = [];

    for (const m of marks) {
      try {
        let result = await Result.findOne({
          examId,
          studentId: m.studentId,
          subjectId: examSubject.subjectId,
          classId: examSubject.classId,
        });

        if (result) {
          if (result.isPublished) {
            errors.push({
              studentId: m.studentId,
              message: "Result published, cannot modify",
            });
            continue;
          }
          result.marksObtained = m.marksObtained;
          result.remarks = m.remarks || result.remarks;
          // Any edit after a previous submission/approval should reset workflow flags.
          result.isSubmitted = false;
          result.isApproved = false;
          await result.save();
        } else {
          result = await Result.create({
            examId,
            studentId: m.studentId,
            subjectId: examSubject.subjectId,
            classId: examSubject.classId,
            examType: exam.examType,
            examName: exam.name,
            marksObtained: m.marksObtained,
            maxMarks: examSubject.maxMarks,
            passingMarks: examSubject.passingMarks,
            academicYear: exam.academicYear,
            enteredBy: teacherId,
            remarks: m.remarks || null,
            isSubmitted: false,
            isApproved: false,
          });
        }
        results.push(result);
      } catch (err) {
        errors.push({ studentId: m.studentId, message: err.message });
      }
    }

    examSubject.marksEntryStatus = "draft";
    if (teacherId) examSubject.submittedBy = teacherId;
    await examSubject.save();

    return { results, errors };
  }

  async submitMarksForApproval(examSubjectId, teacherId) {
    const es = await ExamSubject.findById(examSubjectId);
    if (!es) throw new Error("Exam subject not found");

    const exam = await Exam.findById(es.examId).select("isPublished");
    if (!exam) throw new Error("Exam not found");
    if (exam.isPublished) {
      throw new Error("Exam is published. Results are locked");
    }

    if (es.marksEntryStatus === "approved") {
      throw new Error("Marks already approved");
    }
    if (es.marksEntryStatus === "submitted") {
      throw new Error("Marks already submitted");
    }

    if (teacherId) {
      const schedule = await Schedule.findOne({
        teacherId,
        classId: es.classId,
        subjectId: es.subjectId,
        isActive: true,
      }).select("_id");

      if (!schedule) {
        throw new Error(
          "You are not assigned to teach this subject in this class",
        );
      }
    }

    // Ensure marks exist before allowing submission.
    const marksCount = await Result.countDocuments({
      examId: es.examId,
      classId: es.classId,
      subjectId: es.subjectId,
    });
    if (!marksCount) {
      throw new Error(
        "No marks found for this subject. Save marks before submitting for approval",
      );
    }

    await Result.updateMany(
      {
        examId: es.examId,
        classId: es.classId,
        subjectId: es.subjectId,
      },
      { $set: { isSubmitted: true, isApproved: false } },
    );

    es.marksEntryStatus = "submitted";
    es.submittedBy = teacherId;
    es.submittedAt = new Date();
    await es.save();
    return es;
  }

  async approveMarks(examSubjectId, adminUserId) {
    const es = await ExamSubject.findById(examSubjectId);
    if (!es) throw new Error("Exam subject not found");
    if (es.marksEntryStatus !== "submitted") {
      throw new Error("Marks must be submitted before approval");
    }

    const marksCount = await Result.countDocuments({
      examId: es.examId,
      classId: es.classId,
      subjectId: es.subjectId,
    });
    if (!marksCount) {
      throw new Error(
        "No marks found for this subject. Teacher must enter marks before approval",
      );
    }

    await Result.updateMany(
      {
        examId: es.examId,
        classId: es.classId,
        subjectId: es.subjectId,
      },
      { $set: { isApproved: true } },
    );

    es.marksEntryStatus = "approved";
    es.approvedBy = adminUserId;
    es.approvedAt = new Date();
    await es.save();
    return es;
  }

  async rejectMarks(examSubjectId) {
    const es = await ExamSubject.findById(examSubjectId);
    if (!es) throw new Error("Exam subject not found");
    if (es.marksEntryStatus !== "submitted") {
      throw new Error("Only submitted marks can be rejected");
    }
    es.marksEntryStatus = "rejected";
    es.approvedBy = null;
    es.approvedAt = null;
    await es.save();

    await Result.updateMany(
      {
        examId: es.examId,
        classId: es.classId,
        subjectId: es.subjectId,
      },
      { $set: { isSubmitted: false, isApproved: false } },
    );

    return es;
  }

  async publishExamResults(examId, classId) {
    if (!classId) {
      throw new Error("classId is required to publish results");
    }

    // Must have all subjects approved for this class before publishing.
    const notApproved = await ExamSubject.find({
      examId,
      classId,
      marksEntryStatus: { $ne: "approved" },
    })
      .populate("subjectId", "name code")
      .lean();

    if (notApproved.length) {
      const preview = notApproved
        .slice(0, 5)
        .map((x) => x.subjectId?.name || "Unknown")
        .join(", ");
      throw new Error(
        `Cannot publish. ${notApproved.length} subject(s) are not approved yet. ${preview}${notApproved.length > 5 ? "..." : ""}`,
      );
    }

    const approvedCount = await Result.countDocuments({
      examId,
      classId,
      isApproved: true,
    });
    if (!approvedCount) {
      throw new Error("No approved results found to publish for this class");
    }

    const now = new Date();
    const result = await Result.updateMany(
      { examId, classId, isApproved: true },
      { isPublished: true, publishedAt: now },
    );

    // Mark exam as published if at least one class published.
    await Exam.findByIdAndUpdate(examId, {
      isPublished: true,
      publishedAt: now,
    });

    return result;
  }

  async unpublishExamResults(examId, classId) {
    const query = { examId };
    if (classId) query.classId = classId;
    const result = await Result.updateMany(query, {
      isPublished: false,
      publishedAt: null,
    });

    // If no published results remain for this exam, reset flag.
    const remaining = await Result.countDocuments({
      examId,
      isPublished: true,
    });
    if (!remaining) {
      await Exam.findByIdAndUpdate(examId, {
        isPublished: false,
        publishedAt: null,
      });
    }

    return result;
  }

  async getExamResults(examId, classId, subjectId) {
    const query = { examId };
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;

    return Result.find(query)
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber section",
        populate: { path: "userId", select: "name email" },
      })
      .populate("subjectId", "name code")
      .populate("classId", "name section")
      .sort({ "studentId.rollNumber": 1 });
  }

  async getStudentExamResults(studentId, examId) {
    const query = { studentId };
    if (examId) query.examId = examId;

    return Result.find(query)
      .populate("subjectId", "name code")
      .populate("classId", "name section")
      .populate("examId", "name examType startDate endDate")
      .sort({ createdAt: -1 });
  }

  async getClassAnalytics(examId, classId) {
    const results = await Result.find({ examId, classId })
      .populate("subjectId", "name code")
      .populate({
        path: "studentId",
        select: "rollNumber",
        populate: { path: "userId", select: "name" },
      });

    if (!results.length) return null;

    const subjectMap = {};
    const studentMap = {};

    for (const r of results) {
      const subKey = r.subjectId?._id?.toString();
      if (!subjectMap[subKey]) {
        subjectMap[subKey] = {
          subject: r.subjectId,
          totalStudents: 0,
          totalMarks: 0,
          maxMarks: r.maxMarks,
          passCount: 0,
          failCount: 0,
          highest: 0,
          lowest: r.maxMarks,
          grades: {},
        };
      }
      const s = subjectMap[subKey];
      s.totalStudents++;
      s.totalMarks += r.marksObtained;
      if (r.isPassed) s.passCount++;
      else s.failCount++;
      if (r.marksObtained > s.highest) s.highest = r.marksObtained;
      if (r.marksObtained < s.lowest) s.lowest = r.marksObtained;
      s.grades[r.grade] = (s.grades[r.grade] || 0) + 1;

      const stuKey = r.studentId?._id?.toString();
      if (!studentMap[stuKey]) {
        studentMap[stuKey] = {
          student: r.studentId,
          totalMarks: 0,
          totalMaxMarks: 0,
          subjects: 0,
          allPassed: true,
        };
      }
      const st = studentMap[stuKey];
      st.totalMarks += r.marksObtained;
      st.totalMaxMarks += r.maxMarks;
      st.subjects++;
      if (!r.isPassed) st.allPassed = false;
    }

    const subjectAnalytics = Object.values(subjectMap).map((s) => ({
      ...s,
      average: (s.totalMarks / s.totalStudents).toFixed(2),
      passPercentage: ((s.passCount / s.totalStudents) * 100).toFixed(1),
    }));

    const studentRanking = Object.values(studentMap)
      .map((st) => ({
        ...st,
        percentage: ((st.totalMarks / st.totalMaxMarks) * 100).toFixed(2),
        overallGrade: getGrade((st.totalMarks / st.totalMaxMarks) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .map((st, i) => ({ ...st, rank: i + 1 }));

    const allPercentages = studentRanking.map((s) => parseFloat(s.percentage));
    const overallAvg =
      allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length;

    return {
      subjectAnalytics,
      studentRanking,
      overview: {
        totalStudents: studentRanking.length,
        overallAverage: overallAvg.toFixed(2),
        highestPercentage: Math.max(...allPercentages).toFixed(2),
        lowestPercentage: Math.min(...allPercentages).toFixed(2),
        passCount: studentRanking.filter((s) => s.allPassed).length,
        failCount: studentRanking.filter((s) => !s.allPassed).length,
      },
    };
  }

  async getApprovalQueue() {
    return ExamSubject.find({ marksEntryStatus: "submitted" })
      .populate("examId", "name examType academicYear")
      .populate("subjectId", "name code")
      .populate("classId", "name section")
      .populate({
        path: "submittedBy",
        select: "employeeCode",
        populate: { path: "userId", select: "name" },
      })
      .sort({ submittedAt: -1 });
  }

  async getReportCardData(studentId, examId) {
    const student = await Student.findById(studentId)
      .populate("userId", "name email phone")
      .populate("classId", "name section academicYear");

    if (!student) throw new Error("Student not found");

    const query = { studentId, isPublished: true };
    if (examId) query.examId = examId;

    const results = await Result.find(query)
      .populate("subjectId", "name code credits")
      .populate("examId", "name examType")
      .sort({ "subjectId.name": 1 });

    if (!results.length) return { student, results: [], summary: null };

    const totalMarks = results.reduce((s, r) => s + r.marksObtained, 0);
    const totalMaxMarks = results.reduce((s, r) => s + r.maxMarks, 0);
    const overallPercentage = (totalMarks / totalMaxMarks) * 100;
    const allPassed = results.every((r) => r.isPassed);

    const totalGradePoints = results.reduce(
      (s, r) => s + (typeof r.gradePoint === "number" ? r.gradePoint : 0),
      0,
    );
    const gpa = results.length ? totalGradePoints / results.length : null;

    return {
      student,
      results,
      summary: {
        totalMarks,
        totalMaxMarks,
        overallPercentage: overallPercentage.toFixed(2),
        overallGrade: getGrade(overallPercentage),
        gpa: gpa != null ? gpa.toFixed(2) : null,
        totalSubjects: results.length,
        passedSubjects: results.filter((r) => r.isPassed).length,
        failedSubjects: results.filter((r) => !r.isPassed).length,
        result: allPassed ? "PASS" : "FAIL",
      },
    };
  }

  // ===== DASHBOARDS =====

  async getAdminOverview() {
    const [totalExams, publishedExams] = await Promise.all([
      Exam.countDocuments({}),
      Exam.countDocuments({ isPublished: true }),
    ]);

    const [pendingApproval, draftExamSubjects] = await Promise.all([
      ExamSubject.countDocuments({ marksEntryStatus: "submitted" }),
      ExamSubject.countDocuments({
        marksEntryStatus: { $in: ["pending", "draft", "rejected"] },
      }),
    ]);

    return {
      totalExams,
      draftExamSubjects,
      pendingApproval,
      publishedExams,
    };
  }

  async getStudentPublishedExams(studentId) {
    const examIds = await Result.distinct("examId", {
      studentId,
      isPublished: true,
      examId: { $ne: null },
    });

    if (!examIds.length) return [];

    return Exam.find({ _id: { $in: examIds } })
      .select(
        "name examType academicYear startDate endDate isPublished publishedAt",
      )
      .sort({ startDate: -1 })
      .lean();
  }
}

function getGrade(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C+";
  if (pct >= 40) return "C";
  if (pct >= 33) return "D";
  return "F";
}

export default new ExamResultService();
