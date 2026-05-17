import classService from "../services/class.service.js";

class ClassController {
  // Create a new class
  async createClass(req, res) {
    try {
      const classData = await classService.createClass(req.body);
      res.status(201).json({
        success: true,
        message: "Class created successfully",
        data: classData,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Get all classes
  async getAllClasses(req, res) {
    try {
      const filters = {
        academicYear: req.query.academicYear,
        name: req.query.name,
      };

      const classes = await classService.getAllClasses(filters);
      res.status(200).json({
        success: true,
        count: classes.length,
        data: classes,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Get class by ID
  async getClassById(req, res) {
    try {
      const classData = await classService.getClassById(req.params.id);
      res.status(200).json({
        success: true,
        data: classData,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Update class
  async updateClass(req, res) {
    try {
      const updatedClass = await classService.updateClass(
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: "Class updated successfully",
        data: updatedClass,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Delete class
  async deleteClass(req, res) {
    try {
      
      const result = await classService.deleteClass(req.params.id);
      res.status(200).json({
        success: true,
        message: "Class deleted successfully (soft delete)",
        data: result,
      });
    } catch (error) {
     
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Assign subjects to class
  async assignSubjects(req, res) {
    try {
      const { subjectIds } = req.body;
      const updatedClass = await classService.assignSubjects(
        req.params.id,
        subjectIds
      );
      res.status(200).json({
        success: true,
        message: "Subjects assigned successfully",
        data: updatedClass,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Remove subject from class
  async removeSubject(req, res) {
    try {
      const updatedClass = await classService.removeSubject(
        req.params.id,
        req.params.subjectId
      );
      res.status(200).json({
        success: true,
        message: "Subject removed successfully",
        data: updatedClass,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new ClassController();
