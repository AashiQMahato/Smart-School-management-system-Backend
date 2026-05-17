/**
 * Calendar Service
 * Business logic for academic year and calendar event management
 */

import AcademicYear from "../models/academicYear.model.js";
import CalendarEvent from "../models/calendarEvent.model.js";
import Student from "../models/student.model.js";

class CalendarService {
  // ==================== ACADEMIC YEAR ====================

  async createAcademicYear(data) {
    const academicYear = new AcademicYear(data);
    await academicYear.save();
    return academicYear.populate("createdBy", "name email");
  }

  async getAllAcademicYears() {
    return AcademicYear.find()
      .sort({ startDate: -1 })
      .populate("createdBy", "name email");
  }

  async getCurrentAcademicYear() {
    return AcademicYear.findOne({ isCurrent: true }).populate(
      "createdBy",
      "name email",
    );
  }

  async updateAcademicYear(id, data) {
    const academicYear = await AcademicYear.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).populate("createdBy", "name email");

    if (!academicYear) {
      throw new Error("Academic year not found");
    }

    // If setting as current, unset others
    if (data.isCurrent) {
      await AcademicYear.updateMany({ _id: { $ne: id } }, { isCurrent: false });
    }

    return academicYear;
  }

  async deleteAcademicYear(id) {
    const academicYear = await AcademicYear.findByIdAndDelete(id);
    if (!academicYear) {
      throw new Error("Academic year not found");
    }
    // Clean up associated events
    await CalendarEvent.deleteMany({ academicYear: id });
    return academicYear;
  }

  // ==================== CALENDAR EVENTS ====================

  async createEvent(data) {
    const event = new CalendarEvent(data);
    await event.save();
    return event.populate([
      { path: "createdBy", select: "name email role" },
      { path: "classId", select: "name section" },
      { path: "academicYear", select: "name" },
    ]);
  }

  async getEvents(filters = {}) {
    const query = {};

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.$or = [];
      if (filters.startDate && filters.endDate) {
        query.$or = [
          {
            startDate: {
              $gte: new Date(filters.startDate),
              $lte: new Date(filters.endDate),
            },
          },
          {
            endDate: {
              $gte: new Date(filters.startDate),
              $lte: new Date(filters.endDate),
            },
          },
          {
            startDate: { $lte: new Date(filters.startDate) },
            endDate: { $gte: new Date(filters.endDate) },
          },
        ];
      } else if (filters.startDate) {
        query.endDate = { $gte: new Date(filters.startDate) };
      } else if (filters.endDate) {
        query.startDate = { $lte: new Date(filters.endDate) };
      }
    }

    // Month/Year filter (for calendar view)
    if (filters.month && filters.year) {
      const monthStart = new Date(filters.year, filters.month - 1, 1);
      const monthEnd = new Date(filters.year, filters.month, 0, 23, 59, 59);
      query.$or = [
        { startDate: { $gte: monthStart, $lte: monthEnd } },
        { endDate: { $gte: monthStart, $lte: monthEnd } },
        { startDate: { $lte: monthStart }, endDate: { $gte: monthEnd } },
      ];
    }

    // Event type filter
    if (filters.eventType) {
      query.eventType = filters.eventType;
    }

    // Class filter
    if (filters.classId) {
      query.$or = query.$or || [];
      const classFilter = [{ classId: filters.classId }, { classId: null }];
      if (query.$or.length > 0) {
        // Combine with existing $or using $and
        const existingOr = [...query.$or];
        delete query.$or;
        query.$and = [{ $or: existingOr }, { $or: classFilter }];
      } else {
        query.$or = classFilter;
      }
    }

    // Role visibility filter
    if (filters.role && filters.role !== "admin") {
      query.roleVisibility = { $in: [filters.role] };
      query.isPublished = true;
    }

    // Published filter for admin
    if (filters.isPublished !== undefined) {
      query.isPublished =
        filters.isPublished === "true" || filters.isPublished === true;
    }

    // Academic year filter
    if (filters.academicYear) {
      query.academicYear = filters.academicYear;
    }

    return CalendarEvent.find(query)
      .sort({ startDate: 1 })
      .populate("createdBy", "name email role")
      .populate("classId", "name section")
      .populate("academicYear", "name");
  }

  async getEventById(id) {
    const event = await CalendarEvent.findById(id)
      .populate("createdBy", "name email role")
      .populate("classId", "name section")
      .populate("academicYear", "name");

    if (!event) {
      throw new Error("Event not found");
    }
    return event;
  }

  async updateEvent(id, data) {
    const event = await CalendarEvent.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email role")
      .populate("classId", "name section")
      .populate("academicYear", "name");

    if (!event) {
      throw new Error("Event not found");
    }
    return event;
  }

  async deleteEvent(id) {
    const event = await CalendarEvent.findByIdAndDelete(id);
    if (!event) {
      throw new Error("Event not found");
    }
    return event;
  }

  async togglePublish(id) {
    const event = await CalendarEvent.findById(id);
    if (!event) {
      throw new Error("Event not found");
    }
    event.isPublished = !event.isPublished;
    await event.save();
    return event.populate([
      { path: "createdBy", select: "name email role" },
      { path: "classId", select: "name section" },
    ]);
  }

  // ==================== ANALYTICS ====================

  async getAnalytics(filters = {}) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const [totalThisMonth, upcomingExams, holidayCount, allEventsThisMonth] =
      await Promise.all([
        CalendarEvent.countDocuments({
          $or: [
            { startDate: { $gte: monthStart, $lte: monthEnd } },
            { endDate: { $gte: monthStart, $lte: monthEnd } },
          ],
        }),
        CalendarEvent.countDocuments({
          eventType: "exam",
          startDate: { $gte: now },
          isPublished: true,
        }),
        CalendarEvent.countDocuments({
          eventType: "holiday",
          $or: [
            { startDate: { $gte: monthStart, $lte: monthEnd } },
            { endDate: { $gte: monthStart, $lte: monthEnd } },
          ],
        }),
        CalendarEvent.find({
          $or: [
            { startDate: { $gte: monthStart, $lte: monthEnd } },
            { endDate: { $gte: monthStart, $lte: monthEnd } },
          ],
        }).sort({ startDate: 1 }),
      ]);

    // Check for overlapping events (same date and type)
    const overlappingWarnings = [];
    for (let i = 0; i < allEventsThisMonth.length; i++) {
      for (let j = i + 1; j < allEventsThisMonth.length; j++) {
        const a = allEventsThisMonth[i];
        const b = allEventsThisMonth[j];
        if (
          a.eventType === b.eventType &&
          a.startDate <= b.endDate &&
          b.startDate <= a.endDate
        ) {
          overlappingWarnings.push({
            event1: { id: a._id, title: a.title },
            event2: { id: b._id, title: b.title },
            type: a.eventType,
          });
        }
      }
    }

    return {
      totalThisMonth,
      upcomingExams,
      holidayCount,
      overlappingWarnings: overlappingWarnings.slice(0, 10),
    };
  }

  // ==================== STUDENT/PARENT SPECIFIC ====================

  async getStudentEvents(userId, filters = {}) {
    // Get student's class
    const student = await Student.findOne({ userId }).select("classId");
    if (!student) {
      throw new Error("Student profile not found");
    }

    return this.getEvents({
      ...filters,
      role: "student",
      classId: student.classId,
    });
  }

  async getParentEvents(children, filters = {}) {
    // children is an array of student objects with classId
    const classIds = [
      ...new Set(children.map((c) => c.classId?.toString()).filter(Boolean)),
    ];

    const query = {
      isPublished: true,
      roleVisibility: { $in: ["parent"] },
    };

    // Date filters
    if (filters.month && filters.year) {
      const monthStart = new Date(filters.year, filters.month - 1, 1);
      const monthEnd = new Date(filters.year, filters.month, 0, 23, 59, 59);
      query.$or = [
        { startDate: { $gte: monthStart, $lte: monthEnd } },
        { endDate: { $gte: monthStart, $lte: monthEnd } },
        { startDate: { $lte: monthStart }, endDate: { $gte: monthEnd } },
      ];
    }

    if (filters.eventType) {
      query.eventType = filters.eventType;
    }

    // Get events for all children's classes + global events
    const classFilter =
      classIds.length > 0
        ? { $or: [{ classId: { $in: classIds } }, { classId: null }] }
        : { classId: null };

    const finalQuery = { ...query, ...classFilter };

    // Handle $or conflicts
    if (query.$or && classFilter.$or) {
      delete finalQuery.$or;
      finalQuery.$and = [{ $or: query.$or }, { $or: classFilter.$or }];
    }

    return CalendarEvent.find(finalQuery)
      .sort({ startDate: 1 })
      .populate("createdBy", "name email role")
      .populate("classId", "name section")
      .populate("academicYear", "name");
  }
}

export default new CalendarService();
