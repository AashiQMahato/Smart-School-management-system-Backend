/**
 * AI Controller
 * Chatbot endpoints (Frontend -> Backend -> Groq -> Backend -> Frontend)
 * NOTE: Never expose GROQ_API_KEY to the frontend.
 */

import Student from "../models/student.model.js";
import Teacher from "../models/teacher.model.js";
import Parent from "../models/parent.model.js";
import Attendance from "../models/attendance.model.js";
import Result from "../models/result.model.js";
import Fee from "../models/fee.model.js";
import Exam from "../models/exam.model.js";
import CalendarEvent from "../models/calendarEvent.model.js";
import Schedule from "../models/schedule.model.js";
import aiService from "../services/ai.service.js";

function currentAcademicYear() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

function clampArray(arr, max = 10) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(Math.max(0, arr.length - max));
}

function sanitizeHistory(history) {
  const allowedRoles = new Set(["user", "assistant"]);
  return clampArray(history, 12)
    .map((m) => ({
      role: allowedRoles.has(m?.role) ? m.role : "user",
      content: String(m?.content || "").slice(0, 2000),
    }))
    .filter((m) => m.content.trim().length > 0);
}

async function buildCommonContext({ user, academicYear }) {
  const now = new Date();
  const next30 = new Date(now);
  next30.setDate(now.getDate() + 30);

  // Calendar events visible to role
  const calendarEvents = await CalendarEvent.find({
    isPublished: true,
    roleVisibility: user.role,
    startDate: { $lte: next30 },
    endDate: { $gte: now },
  })
    .sort({ startDate: 1 })
    .select("title startDate endDate eventType classId")
    .lean();

  return {
    today: now.toISOString(),
    academicYear,
    user: { id: String(user._id), name: user.name, role: user.role },
    upcomingEvents: (calendarEvents || []).slice(0, 8).map((e) => ({
      title: e.title,
      eventType: e.eventType,
      startDate: e.startDate,
      endDate: e.endDate,
      classId: e.classId ? String(e.classId) : null,
    })),
  };
}

async function buildStudentContext({ user, academicYear }) {
  const student = await Student.findOne({ userId: user._id })
    .populate("classId", "name section")
    .lean();

  if (!student) return { student: null };

  const now = new Date();
  const last120 = new Date(now);
  last120.setDate(now.getDate() - 120);

  const examQuery = {
    academicYear,
    status: { $in: ["upcoming", "ongoing"] },
    startDate: { $gte: new Date(now.getTime() - 1000 * 60 * 60 * 24) },
  };
  if (student.classId?._id) examQuery.classes = student.classId._id;

  const [attendances, results, fees, exams, timetable] = await Promise.all([
    Attendance.find({ studentId: student._id, date: { $gte: last120 } })
      .populate("subjectId", "name")
      .sort({ date: -1 })
      .lean(),
    Result.find({ studentId: student._id, academicYear, isPublished: true })
      .populate("subjectId", "name")
      .sort({ createdAt: -1 })
      .lean(),
    Fee.find({ studentId: student._id, academicYear })
      .sort({ dueDate: 1 })
      .lean(),
    Exam.find(examQuery)
      .sort({ startDate: 1 })
      .select("name examType startDate endDate status")
      .lean(),
    student.classId
      ? Schedule.find({
          classId: student.classId._id,
          academicYear,
          isActive: true,
        })
          .populate("subjectId", "name")
          .sort({ dayOfWeek: 1, startTime: 1 })
          .lean()
      : Promise.resolve([]),
  ]);

  const totalMarked = attendances.length;
  const present = attendances.filter(
    (a) => a.status === "present" || a.status === "late",
  ).length;
  const attendanceRate =
    totalMarked > 0 ? Math.round((present / totalMarked) * 100) : null;

  // Subject averages
  const subjectBuckets = new Map();
  for (const r of results) {
    const subject = r.subjectId?.name || "Unknown";
    if (!subjectBuckets.has(subject)) subjectBuckets.set(subject, []);
    subjectBuckets.get(subject).push(r.percentage || 0);
  }
  const subjectAverages = Array.from(subjectBuckets.entries())
    .map(([subject, arr]) => ({
      subject,
      avg: Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10,
      exams: arr.length,
    }))
    .sort((a, b) => b.avg - a.avg);

  const pendingFees = fees
    .filter((f) => f.paymentStatus !== "paid" && (f.balanceDue || 0) > 0)
    .map((f) => ({
      feeType: f.feeType,
      dueDate: f.dueDate,
      balanceDue: Math.round((f.balanceDue || 0) * 100) / 100,
      status: f.paymentStatus,
      period: f.period || null,
    }))
    .slice(0, 8);

  // Next class today (if timetable exists)
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const currentTime = now.toTimeString().slice(0, 5);
  const todayPeriods = (timetable || []).filter((p) => p.dayOfWeek === weekday);
  const nextPeriod = todayPeriods
    .filter((p) => p.startTime >= currentTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

  return {
    student: {
      id: String(student._id),
      class: student.classId
        ? `${student.classId.name} ${student.classId.section || ""}`.trim()
        : null,
    },
    attendance: {
      last120Days: {
        marked: totalMarked,
        present,
        rate: attendanceRate,
      },
      recent: (attendances || []).slice(0, 12).map((a) => ({
        date: a.date,
        status: a.status,
        subject: a.subjectId?.name || null,
      })),
    },
    results: {
      examsCount: results.length,
      subjectAverages: subjectAverages.slice(0, 10),
      recent: (results || []).slice(0, 10).map((r) => ({
        subject: r.subjectId?.name || null,
        examType: r.examType,
        percentage: Math.round((r.percentage || 0) * 10) / 10,
        status: r.status,
      })),
    },
    fees: {
      pendingCount: pendingFees.length,
      pending: pendingFees,
    },
    exams: (exams || []).slice(0, 6).map((e) => ({
      name: e.name,
      examType: e.examType,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
    })),
    schedule: {
      nextClassToday: nextPeriod
        ? {
            subject: nextPeriod.subjectId?.name || null,
            startTime: nextPeriod.startTime,
            endTime: nextPeriod.endTime,
            room: nextPeriod.room,
          }
        : null,
    },
  };
}

async function buildTeacherContext({ user, academicYear }) {
  const teacher = await Teacher.findOne({ userId: user._id })
    .populate("assignedClasses", "name section")
    .lean();

  if (!teacher) return { teacher: null };

  const classIds = (teacher.assignedClasses || []).map((c) => c._id);
  const now = new Date();
  const last90 = new Date(now);
  last90.setDate(now.getDate() - 90);

  const [studentsCount, results, attendances] = await Promise.all([
    Student.countDocuments({
      classId: { $in: classIds },
      enrollmentStatus: "active",
    }),
    Result.find({ classId: { $in: classIds }, academicYear, isPublished: true })
      .populate("subjectId", "name")
      .populate({
        path: "studentId",
        populate: { path: "userId", select: "name" },
      })
      .lean(),
    Attendance.find({ classId: { $in: classIds }, date: { $gte: last90 } })
      .populate("subjectId", "name")
      .lean(),
  ]);

  // Weak students (simple heuristic): avg < 45 or attendance < 75
  const perStudent = new Map();
  for (const r of results) {
    const sid = String(r.studentId?._id || r.studentId);
    if (!perStudent.has(sid)) {
      perStudent.set(sid, {
        name: r.studentId?.userId?.name || "Unknown",
        scores: [],
        attendance: { marked: 0, present: 0 },
      });
    }
    perStudent.get(sid).scores.push(r.percentage || 0);
  }
  for (const a of attendances) {
    const sid = String(a.studentId);
    if (!perStudent.has(sid)) {
      perStudent.set(sid, {
        name: "Unknown",
        scores: [],
        attendance: { marked: 0, present: 0 },
      });
    }
    const entry = perStudent.get(sid);
    entry.attendance.marked++;
    if (a.status === "present" || a.status === "late")
      entry.attendance.present++;
  }
  const weakStudents = Array.from(perStudent.values())
    .map((s) => {
      const avg = s.scores.length
        ? Math.round(
            (s.scores.reduce((x, y) => x + y, 0) / s.scores.length) * 10,
          ) / 10
        : null;
      const att = s.attendance.marked
        ? Math.round((s.attendance.present / s.attendance.marked) * 100)
        : null;
      return { name: s.name, avgScore: avg, attendance: att };
    })
    .filter(
      (s) =>
        (s.avgScore !== null && s.avgScore < 45) ||
        (s.attendance !== null && s.attendance < 75),
    )
    .sort((a, b) => (a.avgScore ?? 999) - (b.avgScore ?? 999))
    .slice(0, 10);

  // Attendance heatmap data (by day, count present)
  const dailyMap = new Map();
  for (const a of attendances) {
    const key = new Date(a.date).toISOString().slice(0, 10);
    if (!dailyMap.has(key))
      dailyMap.set(key, { date: key, total: 0, present: 0 });
    const d = dailyMap.get(key);
    d.total++;
    if (a.status === "present" || a.status === "late") d.present++;
  }
  const attendanceHeatmap = Array.from(dailyMap.values())
    .map((d) => ({
      date: d.date,
      presentRate: d.total ? Math.round((d.present / d.total) * 100) : 0,
      total: d.total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-84);

  return {
    teacher: {
      id: String(teacher._id),
      assignedClasses: (teacher.assignedClasses || []).map((c) => ({
        id: String(c._id),
        name: `${c.name} ${c.section || ""}`.trim(),
      })),
    },
    classSummary: {
      classCount: classIds.length,
      studentsCount,
      weakStudents,
      attendanceHeatmap,
    },
  };
}

async function buildAdminContext({ academicYear }) {
  const now = new Date();
  const last30 = new Date(now);
  last30.setDate(now.getDate() - 30);

  const [attendanceCounts, feeCounts, resultCounts, upcomingExams] =
    await Promise.all([
      Attendance.aggregate([
        { $match: { date: { $gte: last30 } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Fee.aggregate([
        { $match: { academicYear } },
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
            balance: { $sum: "$balanceDue" },
          },
        },
      ]),
      Result.aggregate([
        { $match: { academicYear, isPublished: true } },
        {
          $group: {
            _id: "$examType",
            avg: { $avg: "$percentage" },
            count: { $sum: 1 },
          },
        },
      ]),
      Exam.find({ academicYear, status: { $in: ["upcoming", "ongoing"] } })
        .sort({ startDate: 1 })
        .select("name examType startDate endDate status")
        .lean(),
    ]);

  const att = (attendanceCounts || []).reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});

  const fee = (feeCounts || []).reduce((acc, r) => {
    acc[r._id] = {
      count: r.count,
      balance: Math.round((r.balance || 0) * 100) / 100,
    };
    return acc;
  }, {});

  const results = (resultCounts || []).map((r) => ({
    examType: r._id,
    avgPercentage: Math.round((r.avg || 0) * 10) / 10,
    count: r.count,
  }));

  return {
    adminSummary: {
      attendanceLast30Days: att,
      feesByStatus: fee,
      resultsByExamType: results,
      upcomingExams: (upcomingExams || []).slice(0, 6),
    },
  };
}

async function buildParentContext({ user, academicYear }) {
  const parent = await Parent.findOne({ userId: user._id }).lean();
  if (!parent) return { parent: null };

  const children = await Student.find({
    parentId: parent._id,
    enrollmentStatus: "active",
  })
    .populate("classId", "name section")
    .populate("userId", "name")
    .lean();

  const childIds = children.map((c) => c._id);

  const now = new Date();
  const last120 = new Date(now);
  last120.setDate(now.getDate() - 120);

  const [results, attendances, fees] = await Promise.all([
    Result.find({
      studentId: { $in: childIds },
      academicYear,
      isPublished: true,
    })
      .populate("subjectId", "name")
      .lean(),
    Attendance.find({
      studentId: { $in: childIds },
      date: { $gte: last120 },
    }).lean(),
    Fee.find({ studentId: { $in: childIds }, academicYear }).lean(),
  ]);

  const byChild = new Map(
    children.map((c) => [
      String(c._id),
      { child: c, scores: [], attendance: { total: 0, present: 0 }, fees: [] },
    ]),
  );
  for (const r of results) {
    const key = String(r.studentId);
    if (!byChild.has(key)) continue;
    byChild.get(key).scores.push(r.percentage || 0);
  }
  for (const a of attendances) {
    const key = String(a.studentId);
    if (!byChild.has(key)) continue;
    const entry = byChild.get(key);
    entry.attendance.total++;
    if (a.status === "present" || a.status === "late")
      entry.attendance.present++;
  }
  for (const f of fees) {
    const key = String(f.studentId);
    if (!byChild.has(key)) continue;
    if (f.paymentStatus === "paid" || (f.balanceDue || 0) <= 0) continue;
    byChild.get(key).fees.push({
      feeType: f.feeType,
      dueDate: f.dueDate,
      balanceDue: Math.round((f.balanceDue || 0) * 100) / 100,
      status: f.paymentStatus,
    });
  }

  const childrenSummary = Array.from(byChild.values()).map((entry) => {
    const avg = entry.scores.length
      ? Math.round(
          (entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length) * 10,
        ) / 10
      : null;
    const att = entry.attendance.total
      ? Math.round((entry.attendance.present / entry.attendance.total) * 100)
      : null;
    return {
      name: entry.child.userId?.name || "Child",
      class: entry.child.classId
        ? `${entry.child.classId.name} ${entry.child.classId.section || ""}`.trim()
        : null,
      avgScore: avg,
      attendanceRate: att,
      pendingFees: entry.fees.slice(0, 6),
    };
  });

  return {
    parent: { id: String(parent._id) },
    children: childrenSummary,
  };
}

async function buildChatContext(req) {
  const user = req.user;
  const academicYear = req.query.academicYear || currentAcademicYear();
  const base = await buildCommonContext({ user, academicYear });

  if (user.role === "student") {
    return { ...base, ...(await buildStudentContext({ user, academicYear })) };
  }
  if (user.role === "teacher") {
    return { ...base, ...(await buildTeacherContext({ user, academicYear })) };
  }
  if (user.role === "parent") {
    return { ...base, ...(await buildParentContext({ user, academicYear })) };
  }
  if (user.role === "admin") {
    return { ...base, ...(await buildAdminContext({ academicYear })) };
  }
  return base;
}

export const getChatContextPreview = async (req, res) => {
  try {
    const ctx = await buildChatContext(req);
    res.json({ success: true, data: ctx });
  } catch (error) {
    console.error("Context preview error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to build context" });
  }
};

export const chatWithAssistant = async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const history = sanitizeHistory(req.body?.history);

    if (!message) {
      return res
        .status(400)
        .json({ success: false, message: "Message is required" });
    }
    if (message.length > 2000) {
      return res
        .status(400)
        .json({ success: false, message: "Message too long" });
    }

    const context = await buildChatContext(req);

    const systemPrompt = `You are SSMS AI Assistant, a helpful school dashboard chatbot.

Rules:
- Use ONLY the provided CONTEXT JSON for any numbers, dates, names, and pending items.
- If the user asks for data not present in CONTEXT, say what is missing and suggest where to find it in the app.
- Be concise and actionable. Prefer short bullets.
- When answering about: attendance, results, fees, schedules, exams, school events → include the relevant metric and the next step.
- Format output as clean markdown (bullets, short sections). No JSON.

CONTEXT:
${JSON.stringify(context, null, 2)}`;

    const messages = [...history, { role: "user", content: message }];

    const answer = await aiService.chatAssistant({ systemPrompt, messages });

    res.json({
      success: true,
      data: {
        reply: answer,
        meta: {
          role: req.user.role,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "AI chat failed" });
  }
};
