import assignmentService from "../services/assignment.service.js";
import submissionService from "../services/submission.service.js";
import User from "../models/user.model.js";

class AssignmentController {
  // Teacher: Create new assignment
  async createAssignment(req, res) {
    try {
      const assignmentData = {
        ...req.body,
        teacher: req.user._id,
      };

      const assignment = await assignmentService.createAssignment(
        assignmentData,
        {
          actorRole: "teacher",
          teacherUserId: req.user._id,
          teacherProfileId: req.user.profileId,
        },
      );

      res.status(201).json({
        success: true,
        message: "Assignment created successfully",
        data: assignment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Teacher: Get all assignments
  async getTeacherAssignments(req, res) {
    try {
      const filters = {
        status: req.query.status,
        class: req.query.class,
        subject: req.query.subject,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await assignmentService.getTeacherAssignments(
        req.user._id,
        filters,
      );

      res.status(200).json({
        success: true,
        data: result.assignments,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Student: Get all assignments
  async getStudentAssignments(req, res) {
    try {
      const filters = {
        subject: req.query.subject,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await assignmentService.getStudentAssignments(
        req.user._id,
        filters,
      );

      res.status(200).json({
        success: true,
        data: result.assignments,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Get assignment by ID
  async getAssignmentById(req, res) {
    try {
      const assignment = await assignmentService.getAssignmentById(
        req.params.id,
        req.user._id,
        req.user.role,
      );

      res.status(200).json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Teacher: Update assignment
  async updateAssignment(req, res) {
    try {
      const assignment = await assignmentService.updateAssignment(
        req.params.id,
        req.body,
        req.user._id,
      );

      res.status(200).json({
        success: true,
        message: "Assignment updated successfully",
        data: assignment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Teacher: Delete assignment
  async deleteAssignment(req, res) {
    try {
      const result = await assignmentService.deleteAssignment(
        req.params.id,
        req.user._id,
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Teacher: Get assignment analytics
  async getAssignmentAnalytics(req, res) {
    try {
      const filters = {
        academicYear: req.query.academicYear,
      };

      const analytics = await assignmentService.getAssignmentAnalytics(
        req.user._id,
        filters,
      );

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Teacher: Get submissions for an assignment
  async getAssignmentSubmissions(req, res) {
    try {
      const filters = {
        status: req.query.status,
        isLate: req.query.isLate,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await submissionService.getAssignmentSubmissions(
        req.params.id,
        req.user._id,
        filters,
      );

      res.status(200).json({
        success: true,
        data: result.submissions,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Teacher: Get non-submitters
  async getNonSubmitters(req, res) {
    try {
      const nonSubmitters = await submissionService.getNonSubmitters(
        req.params.id,
        req.user._id,
      );

      res.status(200).json({
        success: true,
        count: nonSubmitters.length,
        data: nonSubmitters,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Student: Submit assignment
  async submitAssignment(req, res) {
    try {
      const submissionData = {
        assignment: req.params.id,
        student: req.user._id,
        files: req.body.files,
        submissionNotes: req.body.submissionNotes,
      };

      const submission =
        await submissionService.createSubmission(submissionData);

      res.status(201).json({
        success: true,
        message: "Assignment submitted successfully",
        data: submission,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Student: Get all my submissions
  async getMySubmissions(req, res) {
    try {
      const filters = {
        status: req.query.status,
        subject: req.query.subject,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await submissionService.getStudentSubmissions(
        req.user._id,
        filters,
      );

      res.status(200).json({
        success: true,
        data: result.submissions,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Get submission by ID
  async getSubmissionById(req, res) {
    try {
      const submission = await submissionService.getSubmissionById(
        req.params.id,
      );

      res.status(200).json({
        success: true,
        data: submission,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Student: Update submission
  async updateSubmission(req, res) {
    try {
      const submission = await submissionService.updateSubmission(
        req.params.id,
        req.body,
        req.user._id,
      );

      res.status(200).json({
        success: true,
        message: "Submission updated successfully",
        data: submission,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Teacher: Grade submission
  async gradeSubmission(req, res) {
    try {
      const gradeData = {
        marksObtained: req.body.marksObtained,
        feedback: req.body.feedback,
      };

      const submission = await submissionService.gradeSubmission(
        req.params.id,
        gradeData,
        req.user._id,
      );

      res.status(200).json({
        success: true,
        message: "Submission graded successfully",
        data: submission,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Student: Get submission statistics
  async getSubmissionStats(req, res) {
    try {
      const stats = await submissionService.getSubmissionStats(req.user._id);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Admin: Get all assignments
  async getAdminAssignments(req, res) {
    try {
      const filters = {
        status: req.query.status,
        class: req.query.class,
        subject: req.query.subject,
        teacher: req.query.teacher,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await assignmentService.getAdminAssignments(filters);

      res.status(200).json({
        success: true,
        data: result.assignments,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Admin: Create assignment on behalf of teacher
  async adminCreateAssignment(req, res) {
    try {
      const teacherUserId = req.body.teacher;
      if (!teacherUserId) {
        return res.status(400).json({
          success: false,
          message: "Teacher (user id) is required",
        });
      }

      const teacherUser =
        await User.findById(teacherUserId).select("_id role profileId");

      if (!teacherUser || teacherUser.role !== "teacher") {
        return res.status(400).json({
          success: false,
          message: "Invalid teacher user",
        });
      }

      const assignmentData = {
        ...req.body,
        teacher: teacherUserId,
      };

      const assignment = await assignmentService.createAssignment(
        assignmentData,
        {
          actorRole: "admin",
          teacherUserId: teacherUserId,
          teacherProfileId: teacherUser.profileId,
        },
      );

      res.status(201).json({
        success: true,
        message: "Assignment created successfully",
        data: assignment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Admin: Get assignment by ID
  async adminGetAssignmentById(req, res) {
    try {
      const assignment = await assignmentService.getAssignmentById(
        req.params.id,
        req.user._id,
        "admin",
      );

      res.status(200).json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Admin: Update assignment
  async adminUpdateAssignment(req, res) {
    try {
      const assignment = await assignmentService.adminUpdateAssignment(
        req.params.id,
        req.body,
      );

      res.status(200).json({
        success: true,
        message: "Assignment updated successfully",
        data: assignment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Admin: Delete assignment
  async adminDeleteAssignment(req, res) {
    try {
      const result = await assignmentService.adminDeleteAssignment(
        req.params.id,
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new AssignmentController();
