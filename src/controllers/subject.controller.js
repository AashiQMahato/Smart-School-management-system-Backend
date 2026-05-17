import subjectService from "../services/subject.service.js";

class SubjectController {
  // Create a new subject
  async createSubject(req, res) {
    try {
      const subject = await subjectService.createSubject(req.body);
      res.status(201).json({
        success: true,
        message: "Subject created successfully",
        data: subject,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Get all subjects
  async getAllSubjects(req, res) {
    try {
      const filters = {
        academicYear: req.query.academicYear,
        classId: req.query.classId,
        teacherId: req.query.teacherId,
        showAll: req.query.showAll, // Add ability to fetch all (including inactive)
        isActive: req.query.isActive,
      };

      const subjects = await subjectService.getAllSubjects(filters);

   

      res.status(200).json({
        success: true,
        count: subjects.length,
        data: subjects,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Get subject by ID
  async getSubjectById(req, res) {
    try {
      const subject = await subjectService.getSubjectById(req.params.id);
      res.status(200).json({
        success: true,
        data: subject,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Update subject
  async updateSubject(req, res) {
    try {
      const updatedSubject = await subjectService.updateSubject(
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: "Subject updated successfully",
        data: updatedSubject,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Delete subject
  async deleteSubject(req, res) {
    try {
   
      const result = await subjectService.deleteSubject(req.params.id);
      
      res.status(200).json({
        success: true,
        message: "Subject deleted successfully (soft delete)",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Assign teacher to subject
  async assignTeacher(req, res) {
    try {
      const { teacherId } = req.body;
      const updatedSubject = await subjectService.assignTeacher(
        req.params.id,
        teacherId
      );
      res.status(200).json({
        success: true,
        message: "Teacher assigned successfully",
        data: updatedSubject,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new SubjectController();
