import Submission from "../models/submission.model.js";
import Assignment from "../models/assignment.model.js";
import Student from "../models/student.model.js";
import Parent from "../models/parent.model.js";
import { parsePagination } from "../utils/validation.js";

class SubmissionService {
  // Create submission (student submits assignment)
  async createSubmission(submissionData) {
    try {
      const { assignment, student, studentProfileId, files, submissionNotes } =
        submissionData;

      // Check if assignment exists and is published
      const assignmentDoc = await Assignment.findById(assignment);
      if (!assignmentDoc || !assignmentDoc.isActive) {
        throw new Error("Assignment not found");
      }

      if (assignmentDoc.status !== "published") {
        throw new Error("Assignment is not published yet");
      }

      // Student must belong to the assignment's class
      const studentProfile = studentProfileId
        ? await Student.findById(studentProfileId).select("classId userId")
        : await Student.findOne({ userId: student }).select("classId userId");
      if (
        !studentProfile ||
        String(studentProfile.userId) !== String(student) ||
        String(studentProfile.classId) !== String(assignmentDoc.class)
      ) {
        throw new Error("Unauthorized to submit this assignment");
      }

      // Check if already submitted
      const existingSubmission = await Submission.findOne({
        assignment,
        student,
      });

      if (existingSubmission) {
        throw new Error("You have already submitted this assignment");
      }

      // Check if past due date
      const now = new Date();
      const isLate = now > assignmentDoc.dueDate;

      const submission = await Submission.create({
        assignment,
        student,
        files,
        submissionNotes,
        isLate,
        status: isLate ? "late" : "submitted",
        submittedAt: now,
      });

      return await Submission.findById(submission._id)
        .populate("student", "name email")
        .populate({
          path: "assignment",
          populate: [
            { path: "subject", select: "name code" },
            { path: "class", select: "name section" },
          ],
        });
    } catch (error) {
      throw error;
    }
  }

  // Update submission (before grading, student can update)
  async updateSubmission(submissionId, updateData, studentId) {
    try {
      const submission = await Submission.findOne({
        _id: submissionId,
        student: studentId,
      }).populate("assignment");

      if (!submission) {
        throw new Error("Submission not found or unauthorized");
      }

      // Check if already graded
      if (submission.status === "graded") {
        throw new Error("Cannot update a graded submission");
      }

      // Check if assignment is still open
      const now = new Date();
      if (now > submission.assignment.dueDate) {
        throw new Error("Cannot update submission after due date");
      }

      // Update files and notes
      if (updateData.files) {
        submission.files = updateData.files;
      }
      if (updateData.submissionNotes !== undefined) {
        submission.submissionNotes = updateData.submissionNotes;
      }

      await submission.save();

      return await Submission.findById(submissionId)
        .populate("student", "name email")
        .populate({
          path: "assignment",
          populate: [
            { path: "subject", select: "name code" },
            { path: "class", select: "name section" },
          ],
        });
    } catch (error) {
      throw error;
    }
  }

  // Get all submissions for an assignment (teacher view)
  async getAssignmentSubmissions(assignmentId, teacherUserId, filters = {}) {
    try {
      // Verify teacher owns this assignment
      const assignment =
        await Assignment.findById(assignmentId).select("teacher");
      if (!assignment) {
        throw new Error("Assignment not found");
      }
      if (assignment.teacher.toString() !== teacherUserId.toString()) {
        throw new Error("Unauthorized to view submissions for this assignment");
      }

      const query = { assignment: assignmentId };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.isLate !== undefined) {
        query.isLate = filters.isLate === "true";
      }

      const { page, limit, skip } = parsePagination(
        filters.page,
        filters.limit,
        { defaultLimit: 20 },
      );

      const submissions = await Submission.find(query)
        .populate("student", "name email")
        .populate("gradedBy", "name email")
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Submission.countDocuments(query);

      return {
        submissions,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  // Get student's submissions
  async getStudentSubmissions(studentId, filters = {}) {
    try {
      const query = { student: studentId };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.subject) {
        // Get assignments for this subject
        const assignments = await Assignment.find({ subject: filters.subject });
        const assignmentIds = assignments.map((a) => a._id);
        query.assignment = { $in: assignmentIds };
      }

      const { page, limit, skip } = parsePagination(
        filters.page,
        filters.limit,
      );

      const submissions = await Submission.find(query)
        .populate({
          path: "assignment",
          populate: [
            { path: "subject", select: "name code" },
            { path: "class", select: "name section" },
            { path: "teacher", select: "name email" },
          ],
        })
        .populate("gradedBy", "name email")
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Submission.countDocuments(query);

      return {
        submissions,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  // Get submission by ID
  async getSubmissionById(submissionId) {
    try {
      const submission = await Submission.findById(submissionId)
        .populate("student", "name email")
        .populate({
          path: "assignment",
          populate: [
            { path: "subject", select: "name code" },
            { path: "class", select: "name section" },
            { path: "teacher", select: "name email" },
          ],
        })
        .populate("gradedBy", "name email");

      if (!submission) {
        throw new Error("Submission not found");
      }

      return submission;
    } catch (error) {
      throw error;
    }
  }

  // Object-level access check for a (populated) submission
  async canUserViewSubmission(user, submission) {
    if (!user || !submission) return false;
    if (user.role === "admin") return true;

    const studentUserId = String(submission.student?._id || submission.student);

    if (user.role === "student") {
      return studentUserId === String(user._id);
    }

    if (user.role === "teacher") {
      const teacherUserId =
        submission.assignment?.teacher?._id || submission.assignment?.teacher;
      return String(teacherUserId) === String(user._id);
    }

    if (user.role === "parent") {
      if (!user.profileId) return false;
      const parent = await Parent.findById(user.profileId)
        .select("children")
        .lean();
      if (!parent?.children?.length) return false;
      return !!(await Student.exists({
        _id: { $in: parent.children },
        userId: studentUserId,
      }));
    }

    return false;
  }

  // Grade submission (teacher)
  async gradeSubmission(submissionId, gradeData, teacherId) {
    try {
      const { feedback } = gradeData;
      const marksObtained =
        gradeData.marksObtained === "" || gradeData.marksObtained == null
          ? NaN
          : Number(gradeData.marksObtained);

      const submission =
        await Submission.findById(submissionId).populate("assignment");

      if (!submission) {
        throw new Error("Submission not found");
      }

      // Verify teacher owns this assignment
      if (submission.assignment.teacher.toString() !== teacherId.toString()) {
        throw new Error("Unauthorized to grade this submission");
      }

      // Validate marks
      if (
        !Number.isFinite(marksObtained) ||
        marksObtained < 0 ||
        marksObtained > submission.assignment.totalMarks
      ) {
        throw new Error(
          `Marks must be between 0 and ${submission.assignment.totalMarks}`,
        );
      }

      submission.marksObtained = marksObtained;
      submission.feedback = feedback || "";
      submission.status = "graded";
      submission.gradedAt = new Date();
      submission.gradedBy = teacherId;

      await submission.save();

      return await Submission.findById(submissionId)
        .populate("student", "name email")
        .populate({
          path: "assignment",
          populate: [
            { path: "subject", select: "name code" },
            { path: "class", select: "name section" },
          ],
        })
        .populate("gradedBy", "name email");
    } catch (error) {
      throw error;
    }
  }

  // Get students who haven't submitted
  async getNonSubmitters(assignmentId, teacherUserId) {
    try {
      const assignment = await Assignment.findById(assignmentId)
        .select("teacher class")
        .populate("class");

      if (!assignment) {
        throw new Error("Assignment not found");
      }

      if (assignment.teacher.toString() !== teacherUserId.toString()) {
        throw new Error(
          "Unauthorized to view non-submitters for this assignment",
        );
      }

      // Get all students in the class
      const students = await Student.find({
        classId: assignment.class._id,
      }).populate("userId", "name email");

      // Get all submissions for this assignment
      const submissions = await Submission.find({ assignment: assignmentId });
      const submittedStudentIds = submissions.map((s) => s.student.toString());

      // Filter out students who have submitted
      const nonSubmitters = students.filter(
        (student) =>
          student.userId &&
          !submittedStudentIds.includes(student.userId._id.toString()),
      );

      return nonSubmitters.map((student) => ({
        studentId: student.userId._id,
        name: student.userId.name,
        email: student.userId.email,
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get submission statistics for dashboard
  async getSubmissionStats(studentId) {
    try {
      const totalSubmissions = await Submission.countDocuments({
        student: studentId,
      });
      const gradedSubmissions = await Submission.countDocuments({
        student: studentId,
        status: "graded",
      });
      const lateSubmissions = await Submission.countDocuments({
        student: studentId,
        isLate: true,
      });

      // Calculate average marks
      const gradedSubs = await Submission.find({
        student: studentId,
        status: "graded",
      }).populate("assignment");

      let totalMarks = 0;
      let obtainedMarks = 0;

      gradedSubs.forEach((sub) => {
        totalMarks += sub.assignment.totalMarks;
        obtainedMarks += sub.marksObtained || 0;
      });

      const averagePercentage =
        gradedSubmissions > 0 ? (obtainedMarks / totalMarks) * 100 : 0;

      return {
        totalSubmissions,
        gradedSubmissions,
        pendingGrading: totalSubmissions - gradedSubmissions,
        lateSubmissions,
        averagePercentage: averagePercentage.toFixed(2),
      };
    } catch (error) {
      throw error;
    }
  }
}

export default new SubmissionService();
