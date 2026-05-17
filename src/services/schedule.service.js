import Schedule from "../models/schedule.model.js";
import Subject from "../models/subject.model.js";
import mongoose from "mongoose";

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const getDefaultAcademicYear = () => {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
};

const toMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return Number.POSITIVE_INFINITY;
  const [hRaw, mRaw] = timeStr.split(":");
  const hours = Number(hRaw);
  const minutes = Number(mRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes))
    return Number.POSITIVE_INFINITY;
  return hours * 60 + minutes;
};

const buildTimeMinutesExpr = (fieldName) => {
  const split = { $split: [`$${fieldName}`, ":"] };
  const hours = { $toInt: { $arrayElemAt: [split, 0] } };
  const minutes = { $toInt: { $arrayElemAt: [split, 1] } };
  return { $add: [{ $multiply: [hours, 60] }, minutes] };
};

const buildOverlapExpr = (newStartMinutes, newEndMinutes) => {
  const existingStart = buildTimeMinutesExpr("startTime");
  const existingEnd = buildTimeMinutesExpr("endTime");

  // Overlap rule: existingStart < newEnd AND existingEnd > newStart
  return {
    $and: [
      { $lt: [existingStart, newEndMinutes] },
      { $gt: [existingEnd, newStartMinutes] },
    ],
  };
};

const normalizeSection = (value) =>
  value == null ? null : String(value).trim().toUpperCase();

const resolveAcademicYear = (value) => {
  const trimmed = value == null ? "" : String(value).trim();
  return trimmed ? trimmed : getDefaultAcademicYear();
};

const groupByDay = (items) => {
  const grouped = DAY_ORDER.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

  for (const item of items) {
    if (!item?.dayOfWeek) continue;
    if (!grouped[item.dayOfWeek]) grouped[item.dayOfWeek] = [];
    grouped[item.dayOfWeek].push(item);
  }

  for (const day of Object.keys(grouped)) {
    grouped[day].sort(
      (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
    );
  }

  return grouped;
};

const normalizeObjectId = (value, fieldName) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  const error = new Error(`${fieldName} must be a valid ObjectId`);
  error.statusCode = 400;
  throw error;
};

const toScheduleDTO = (doc) => {
  const classObj = doc.classId
    ? {
        _id: doc.classId._id,
        name: doc.classId.name,
        section: doc.classId.section,
        academicYear: doc.classId.academicYear,
      }
    : null;

  const subjectObj = doc.subjectId
    ? {
        _id: doc.subjectId._id,
        name: doc.subjectId.name,
        code: doc.subjectId.code,
      }
    : null;

  const teacherName =
    doc.teacherId?.userId?.name || doc.teacherId?.name || null;

  const teacherObj = doc.teacherId
    ? { _id: doc.teacherId._id, name: teacherName }
    : null;

  return {
    _id: doc._id,
    dayOfWeek: doc.dayOfWeek,
    startTime: doc.startTime,
    endTime: doc.endTime,
    room: doc.room,
    academicYear: doc.academicYear,
    section: doc.section,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    classId: classObj,
    subjectId: subjectObj,
    teacherId: teacherObj,
  };
};

class ScheduleService {
  /**
   * Check for scheduling conflicts
   * Returns an object with conflict status and details
   */
  async checkConflicts(scheduleData, excludeId = null) {
    const teacherId = scheduleData?.teacherId
      ? normalizeObjectId(scheduleData.teacherId, "teacherId")
      : null;
    const classId = scheduleData?.classId
      ? normalizeObjectId(scheduleData.classId, "classId")
      : null;
    const section = normalizeSection(scheduleData?.section);
    const room = scheduleData?.room ? String(scheduleData.room).trim() : null;
    const dayOfWeek = scheduleData?.dayOfWeek;
    const academicYear = resolveAcademicYear(scheduleData?.academicYear);
    const startTime = scheduleData?.startTime;
    const endTime = scheduleData?.endTime;

    if (!dayOfWeek) {
      const error = new Error("Day of week is required");
      error.statusCode = 400;
      throw error;
    }

    const newStartMinutes = toMinutes(startTime);
    const newEndMinutes = toMinutes(endTime);
    if (
      !Number.isFinite(newStartMinutes) ||
      !Number.isFinite(newEndMinutes) ||
      newStartMinutes === Number.POSITIVE_INFINITY ||
      newEndMinutes === Number.POSITIVE_INFINITY
    ) {
      const error = new Error("Start time and end time must be valid");
      error.statusCode = 400;
      throw error;
    }

    if (newEndMinutes <= newStartMinutes) {
      const error = new Error("End time must be after start time");
      error.statusCode = 400;
      throw error;
    }

    const baseQuery = {
      dayOfWeek,
      academicYear,
      isActive: true,
    };
    if (excludeId) {
      baseQuery._id = { $ne: normalizeObjectId(excludeId, "scheduleId") };
    }

    const overlapExpr = buildOverlapExpr(newStartMinutes, newEndMinutes);

    const populateSpec = [
      { path: "classId", select: "name section academicYear" },
      { path: "subjectId", select: "name code" },
      {
        path: "teacherId",
        select: "userId",
        populate: { path: "userId", select: "name" },
      },
    ];

    const queries = [];

    if (teacherId) {
      queries.push(
        Schedule.find({
          ...baseQuery,
          teacherId,
          $expr: overlapExpr,
        })
          .limit(10)
          .populate(populateSpec),
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    // Room conflicts are part of existing behavior in this codebase.
    if (room) {
      queries.push(
        Schedule.find({
          ...baseQuery,
          room,
          $expr: overlapExpr,
        })
          .limit(10)
          .populate(populateSpec),
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    if (classId && section) {
      queries.push(
        Schedule.find({
          ...baseQuery,
          classId,
          section,
          $expr: overlapExpr,
        })
          .limit(10)
          .populate(populateSpec),
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    const [teacherSchedules, roomSchedules, classSchedules] =
      await Promise.all(queries);

    const conflicts = [];

    for (const schedule of teacherSchedules) {
      conflicts.push({
        type: "teacher",
        scheduleId: schedule._id,
        schedule: toScheduleDTO(schedule),
        message: `Teacher already has a schedule from ${schedule.startTime} to ${schedule.endTime}`,
      });
    }

    for (const schedule of roomSchedules) {
      conflicts.push({
        type: "room",
        scheduleId: schedule._id,
        schedule: toScheduleDTO(schedule),
        message: `Room is already booked from ${schedule.startTime} to ${schedule.endTime}`,
      });
    }

    for (const schedule of classSchedules) {
      conflicts.push({
        type: "class",
        scheduleId: schedule._id,
        schedule: toScheduleDTO(schedule),
        message: `Class already has a schedule from ${schedule.startTime} to ${schedule.endTime}`,
      });
    }

    // De-duplicate same schedule/type pairs (can happen when inputs overlap)
    const seen = new Set();
    const uniq = [];
    for (const c of conflicts) {
      const key = `${c.type}:${c.scheduleId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(c);
    }

    return {
      hasConflict: uniq.length > 0,
      conflicts: uniq,
    };
  }

  /**
   * Create a new schedule
   */
  async createSchedule(scheduleData) {
    // Auto-assign teacher from subject if not provided
    if (!scheduleData.teacherId && scheduleData.subjectId) {
      const subject = await Subject.findById(scheduleData.subjectId);
      if (!subject) {
        const error = new Error("Subject not found");
        error.statusCode = 404;
        throw error;
      }
      if (!subject.assignedTeacher) {
        const error = new Error(
          "Subject has no assigned teacher. Please assign a teacher to this subject first.",
        );
        error.statusCode = 400;
        throw error;
      }
      scheduleData.teacherId = subject.assignedTeacher;
    }

    // Normalize/ensure defaults (important for conflict detection)
    scheduleData.section = normalizeSection(scheduleData.section);
    scheduleData.academicYear = resolveAcademicYear(scheduleData.academicYear);

    // Check for conflicts
    const conflictCheck = await this.checkConflicts(scheduleData);

    if (conflictCheck.hasConflict) {
      const error = new Error("Schedule conflict detected for selected time");
      error.statusCode = 409;
      error.conflicts = conflictCheck.conflicts;
      throw error;
    }

    const schedule = new Schedule(scheduleData);
    await schedule.save();

    return await Schedule.findById(schedule._id)
      .populate("classId", "name section academicYear")
      .populate("subjectId", "name code")
      .populate({
        path: "teacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "name",
        },
      });
  }

  /**
   * Get all schedules with optional filters
   */
  async getSchedules(filters = {}) {
    const query = { isActive: true };

    // Apply filters
    if (filters.classId)
      query.classId = normalizeObjectId(filters.classId, "classId");
    if (filters.section)
      query.section = String(filters.section).trim().toUpperCase();
    if (filters.teacherId)
      query.teacherId = normalizeObjectId(filters.teacherId, "teacherId");
    if (filters.dayOfWeek) query.dayOfWeek = filters.dayOfWeek;
    // Only filter by academicYear if explicitly provided
    if (filters.academicYear) query.academicYear = filters.academicYear;

    const schedules = await Schedule.find(query)
      .populate("classId", "name section academicYear")
      .populate("subjectId", "name code")
      .populate({
        path: "teacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });

    // Robust sort: day order + time order (handles non-zero-padded times)
    const sorted = schedules.slice().sort((a, b) => {
      const dayA = DAY_ORDER.indexOf(a.dayOfWeek);
      const dayB = DAY_ORDER.indexOf(b.dayOfWeek);
      if (dayA !== dayB) return dayA - dayB;
      return toMinutes(a.startTime) - toMinutes(b.startTime);
    });

    return sorted;
  }

  async getSchedulesUiReady(filters = {}) {
    const schedules = await this.getSchedules(filters);
    const items = schedules.map(toScheduleDTO);
    return {
      items,
      groupedByDay: groupByDay(items),
    };
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(scheduleId) {
    const schedule = await Schedule.findById(scheduleId)
      .populate("classId", "name section academicYear")
      .populate("subjectId", "name code")
      .populate({
        path: "teacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "name",
        },
      });

    if (!schedule) {
      const error = new Error("Schedule not found");
      error.statusCode = 404;
      throw error;
    }

    return schedule;
  }

  /**
   * Update schedule
   */
  async updateSchedule(scheduleId, updateData) {
    const existingSchedule = await Schedule.findById(scheduleId);

    if (!existingSchedule) {
      const error = new Error("Schedule not found");
      error.statusCode = 404;
      throw error;
    }

    // Merge existing data with updates for conflict check
    const scheduleData = {
      classId: updateData.classId || existingSchedule.classId,
      section: normalizeSection(updateData.section || existingSchedule.section),
      subjectId: updateData.subjectId || existingSchedule.subjectId,
      teacherId: updateData.teacherId || existingSchedule.teacherId,
      room: updateData.room || existingSchedule.room,
      dayOfWeek: updateData.dayOfWeek || existingSchedule.dayOfWeek,
      startTime: updateData.startTime || existingSchedule.startTime,
      endTime: updateData.endTime || existingSchedule.endTime,
      academicYear: resolveAcademicYear(
        updateData.academicYear || existingSchedule.academicYear,
      ),
    };

    // Check for conflicts (excluding current schedule)
    const conflictCheck = await this.checkConflicts(scheduleData, scheduleId);

    if (conflictCheck.hasConflict) {
      const error = new Error("Schedule conflict detected for selected time");
      error.statusCode = 409;
      error.conflicts = conflictCheck.conflicts;
      throw error;
    }

    Object.assign(existingSchedule, updateData);
    await existingSchedule.save();

    return await Schedule.findById(scheduleId)
      .populate("classId", "name section academicYear")
      .populate("subjectId", "name code")
      .populate({
        path: "teacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "name",
        },
      });
  }

  /**
   * Delete schedule (soft delete)
   */
  async deleteSchedule(scheduleId) {
    const schedule = await Schedule.findById(scheduleId);

    if (!schedule) {
      const error = new Error("Schedule not found");
      error.statusCode = 404;
      throw error;
    }

    schedule.isActive = false;
    await schedule.save();

    return { message: "Schedule deleted successfully" };
  }

  /**
   * Get weekly schedule for a class
   */
  async getWeeklyScheduleForClass(classId, section, academicYear) {
    const { groupedByDay } = await this.getSchedulesUiReady({
      classId,
      section,
      academicYear,
    });
    return groupedByDay;
  }

  /**
   * Get weekly schedule for a teacher
   */
  async getWeeklyScheduleForTeacher(teacherId, academicYear) {
    // Only include academicYear in filters if it's provided
    const filters = { teacherId };
    if (academicYear) {
      filters.academicYear = academicYear;
    }

    const { groupedByDay } = await this.getSchedulesUiReady(filters);
    return groupedByDay;
  }
}

export default new ScheduleService();
