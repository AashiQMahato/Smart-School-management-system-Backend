/**
 * Calendar Controller
 * Handles HTTP requests for academic calendar operations
 */

import calendarService from "../services/calendar.service.js";
import Student from "../models/student.model.js";
import Parent from "../models/parent.model.js";
import { isTeacherOfClass } from "../utils/access.js";
import { pick } from "../utils/validation.js";

const ACADEMIC_YEAR_FIELDS = [
  "name",
  "startDate",
  "endDate",
  "isCurrent",
  "description",
];
const EVENT_FIELDS = [
  "title",
  "description",
  "startDate",
  "endDate",
  "eventType",
  "roleVisibility",
  "classId",
  "academicYear",
  "isPublished",
  "isAllDay",
  "color",
  "linkedEntity",
];

// ==================== ACADEMIC YEAR ====================

export const createAcademicYear = async (req, res) => {
  try {
    const data = {
      ...pick(req.body, ACADEMIC_YEAR_FIELDS),
      createdBy: req.user._id,
    };
    const academicYear = await calendarService.createAcademicYear(data);
    res.status(201).json({ success: true, data: academicYear });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllAcademicYears = async (req, res) => {
  try {
    const years = await calendarService.getAllAcademicYears();
    res.json({ success: true, data: years });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCurrentAcademicYear = async (req, res) => {
  try {
    const year = await calendarService.getCurrentAcademicYear();
    res.json({ success: true, data: year });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAcademicYear = async (req, res) => {
  try {
    const academicYear = await calendarService.updateAcademicYear(
      req.params.id,
      pick(req.body, ACADEMIC_YEAR_FIELDS),
    );
    res.json({ success: true, data: academicYear });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteAcademicYear = async (req, res) => {
  try {
    await calendarService.deleteAcademicYear(req.params.id);
    res.json({ success: true, message: "Academic year deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==================== CALENDAR EVENTS ====================

export const createEvent = async (req, res) => {
  try {
    const data = { ...pick(req.body, EVENT_FIELDS), createdBy: req.user._id };
    const event = await calendarService.createEvent(data);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    const filters = {
      ...req.query,
      role: req.user.role,
    };
    const events = await calendarService.getEvents(filters);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await calendarService.getEventById(req.params.id);

    // Non-admins can only read published events visible to their role
    if (
      req.user.role !== "admin" &&
      (!event.isPublished ||
        !(event.roleVisibility || []).includes(req.user.role))
    ) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const event = await calendarService.updateEvent(
      req.params.id,
      pick(req.body, EVENT_FIELDS),
    );
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    await calendarService.deleteEvent(req.params.id);
    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const togglePublish = async (req, res) => {
  try {
    const event = await calendarService.togglePublish(req.params.id);
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==================== ANALYTICS ====================

export const getAnalytics = async (req, res) => {
  try {
    const analytics = await calendarService.getAnalytics(req.query);
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STUDENT EVENTS ====================

export const getStudentEvents = async (req, res) => {
  try {
    const events = await calendarService.getStudentEvents(
      req.user._id,
      req.query,
    );
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PARENT EVENTS ====================

export const getParentEvents = async (req, res) => {
  try {
    // Get parent's children
    const parent = await Parent.findOne({ userId: req.user._id });
    if (!parent) {
      return res
        .status(404)
        .json({ success: false, message: "Parent profile not found" });
    }

    const children = await Student.find({ parentId: parent._id }).select(
      "classId userId",
    );

    const events = await calendarService.getParentEvents(children, req.query);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TEACHER EVENTS ====================

export const getTeacherEvents = async (req, res) => {
  try {
    const filters = {
      ...req.query,
      role: "teacher",
    };
    const events = await calendarService.getEvents(filters);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTeacherEvent = async (req, res) => {
  try {
    // Teachers can only create class-level events
    if (!req.body.classId) {
      return res.status(400).json({
        success: false,
        message: "Teachers must specify a class for event creation",
      });
    }
    if (!(await isTeacherOfClass(req.user, req.body.classId))) {
      return res.status(403).json({
        success: false,
        message: "You can only create events for classes you teach",
      });
    }
    const data = {
      ...pick(req.body, EVENT_FIELDS),
      createdBy: req.user._id,
      // Teachers cannot set admin-level visibility
      roleVisibility: ["teacher", "student", "parent"],
    };
    const event = await calendarService.createEvent(data);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
