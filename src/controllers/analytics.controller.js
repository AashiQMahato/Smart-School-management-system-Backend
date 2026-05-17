/**
 * Analytics Controller
 * Gathers real data from models, sends to Groq AI via ai.service, returns insights
 */

import Student from "../models/student.model.js";
import Attendance from "../models/attendance.model.js";
import Result from "../models/result.model.js";
import Fee from "../models/fee.model.js";
import Class from "../models/class.model.js";
import Subject from "../models/subject.model.js";
import Teacher from "../models/teacher.model.js";
import Parent from "../models/parent.model.js";
import aiService from "../services/ai.service.js";

// Helper — current academic year string
function currentAcademicYear() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

function monthKey(date) {
  try {
    return new Date(date).toISOString().slice(0, 7); // YYYY-MM
  } catch {
    return null;
  }
}

function lastNMonths(n = 6) {
  const now = new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(now.getMonth() - i);
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

// ────────────── ADMIN ──────────────
export const getAdminAnalytics = async (req, res) => {
  try {
    const academicYear = req.query.academicYear || currentAcademicYear();

    // Gather school-wide data in parallel
    const [students, results, attendances, fees, classes, subjects] =
      await Promise.all([
        Student.find({ enrollmentStatus: "active" })
          .populate("classId", "name section")
          .populate("userId", "name email")
          .lean(),
        Result.find({ academicYear })
          .populate("subjectId", "name")
          .populate("classId", "name section")
          .lean(),
        Attendance.find({
          date: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
          },
        }).lean(),
        Fee.find({ academicYear }).lean(),
        Class.find({ isActive: true }).lean(),
        Subject.find({ isActive: true }).lean(),
      ]);

    // Build summary data for AI
    const totalStudents = students.length;
    const totalClasses = classes.length;

    // Class-level aggregation
    const classStats = classes.map((cls) => {
      const classResults = results.filter(
        (r) => String(r.classId?._id || r.classId) === String(cls._id),
      );
      const classAttendance = attendances.filter(
        (a) => String(a.classId) === String(cls._id),
      );
      const avgScore =
        classResults.length > 0
          ? classResults.reduce((s, r) => s + (r.percentage || 0), 0) /
            classResults.length
          : 0;
      const presentCount = classAttendance.filter(
        (a) => a.status === "present" || a.status === "late",
      ).length;
      const avgAttendance =
        classAttendance.length > 0
          ? (presentCount / classAttendance.length) * 100
          : 0;
      return {
        className: `${cls.name} ${cls.section || ""}`.trim(),
        studentCount: students.filter(
          (s) => String(s.classId?._id || s.classId) === String(cls._id),
        ).length,
        avgScore: Math.round(avgScore * 10) / 10,
        avgAttendance: Math.round(avgAttendance * 10) / 10,
      };
    });

    // Subject-level aggregation
    const subjectStats = subjects.map((sub) => {
      const subResults = results.filter(
        (r) => String(r.subjectId?._id || r.subjectId) === String(sub._id),
      );
      const avg =
        subResults.length > 0
          ? subResults.reduce((s, r) => s + (r.percentage || 0), 0) /
            subResults.length
          : 0;
      const failCount = subResults.filter((r) => r.status === "Fail").length;
      return {
        subject: sub.name,
        avgScore: Math.round(avg * 10) / 10,
        failRate:
          subResults.length > 0
            ? Math.round((failCount / subResults.length) * 100)
            : 0,
        totalExams: subResults.length,
      };
    });

    // Fee aggregation
    const totalFeeExpected = fees.reduce((s, f) => s + (f.totalAmount || 0), 0);
    const totalFeeCollected = fees.reduce((s, f) => s + (f.amountPaid || 0), 0);
    const overdueFees = fees.filter(
      (f) => f.paymentStatus === "overdue",
    ).length;

    // Overall attendance
    const totalPresent = attendances.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length;
    const overallAttendanceRate =
      attendances.length > 0
        ? Math.round((totalPresent / attendances.length) * 100 * 10) / 10
        : 0;

    const payload = {
      academicYear,
      totalStudents,
      totalClasses,
      overallAttendanceRate,
      feeStats: {
        totalExpected: totalFeeExpected,
        totalCollected: totalFeeCollected,
        collectionRate:
          totalFeeExpected > 0
            ? Math.round((totalFeeCollected / totalFeeExpected) * 100)
            : 0,
        overdueCount: overdueFees,
      },
      classStats: classStats.slice(0, 15),
      subjectStats: subjectStats.slice(0, 15),
      recentResultsCount: results.length,
    };

    const insights = await aiService.getAdminInsights(payload);

    // Build a real at-risk students list from DB signals so the UI can
    // reliably show student names/details (AI summaries may omit identities).
    const perStudent = new Map();
    for (const s of students) {
      perStudent.set(String(s._id), {
        name: s.userId?.name || "Unknown",
        class: `${s.classId?.name || ""} ${s.classId?.section || ""}`.trim(),
        status: s.enrollmentStatus || "—",
        scoreSum: 0,
        scoreCount: 0,
        attMarked: 0,
        attPresent: 0,
        overdueFees: 0,
      });
    }

    for (const r of results) {
      const sid = String(r.studentId);
      const entry = perStudent.get(sid);
      if (!entry) continue;
      entry.scoreSum += r.percentage || 0;
      entry.scoreCount += 1;
    }

    for (const a of attendances) {
      const sid = String(a.studentId);
      const entry = perStudent.get(sid);
      if (!entry) continue;
      entry.attMarked += 1;
      if (a.status === "present" || a.status === "late") entry.attPresent += 1;
    }

    for (const f of fees) {
      const sid = String(f.studentId);
      const entry = perStudent.get(sid);
      if (!entry) continue;
      if (f.paymentStatus === "overdue") entry.overdueFees += 1;
    }

    const atRiskStudentsComputed = Array.from(perStudent.values())
      .map((s) => {
        const avgScore = s.scoreCount ? s.scoreSum / s.scoreCount : null;
        const attendanceRate = s.attMarked
          ? (s.attPresent / s.attMarked) * 100
          : null;

        const reasons = [];
        if (avgScore !== null && avgScore < 50)
          reasons.push(`Low average score (${Math.round(avgScore)}%)`);
        if (attendanceRate !== null && attendanceRate < 75)
          reasons.push(`Low attendance (${Math.round(attendanceRate)}%)`);
        if (s.overdueFees > 0) reasons.push(`Overdue fees (${s.overdueFees})`);

        let risk = "low";
        if (
          (avgScore !== null && avgScore < 40) ||
          (attendanceRate !== null && attendanceRate < 60) ||
          s.overdueFees >= 2
        ) {
          risk = "high";
        } else if (
          (avgScore !== null && avgScore < 50) ||
          (attendanceRate !== null && attendanceRate < 75) ||
          s.overdueFees === 1
        ) {
          risk = "medium";
        }

        return {
          name: s.name,
          class: s.class,
          status: s.status,
          risk,
          reason: reasons.join(" • ") || "Needs review",
          avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
          attendanceRate:
            attendanceRate !== null
              ? Math.round(attendanceRate * 10) / 10
              : null,
          overdueFees: s.overdueFees,
        };
      })
      .filter((s) => s.risk !== "low")
      .sort((a, b) => {
        const w = { high: 0, medium: 1, low: 2 };
        const rw = (w[a.risk] ?? 9) - (w[b.risk] ?? 9);
        if (rw !== 0) return rw;
        const as = a.avgScore ?? 999;
        const bs = b.avgScore ?? 999;
        if (as !== bs) return as - bs;
        const aa = a.attendanceRate ?? 999;
        const ba = b.attendanceRate ?? 999;
        return aa - ba;
      })
      .slice(0, 25);

    const normalizedInsights = {
      ...(insights || {}),
      atRiskStudents: atRiskStudentsComputed,
    };

    // Chart-ready datasets
    const attDist = (attendances || []).reduce(
      (acc, a) => {
        const k = a.status || "unknown";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      },
      { present: 0, absent: 0, late: 0, excused: 0 },
    );

    const feeDist = (fees || []).reduce(
      (acc, f) => {
        const k = f.paymentStatus || "unpaid";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      },
      { paid: 0, unpaid: 0, partial: 0, overdue: 0 },
    );

    const months = lastNMonths(6);
    const resultByMonth = months.map((m) => {
      const inMonth = (results || []).filter(
        (r) => monthKey(r.createdAt) === m,
      );
      const avg =
        inMonth.length > 0
          ? inMonth.reduce((s, r) => s + (r.percentage || 0), 0) /
            inMonth.length
          : 0;
      return {
        month: m,
        avgScore: Math.round(avg * 10) / 10,
        exams: inMonth.length,
      };
    });

    const feeByMonth = months.map((m) => {
      const inMonth = (fees || []).filter((f) => monthKey(f.dueDate) === m);
      const expected = inMonth.reduce((s, f) => s + (f.totalAmount || 0), 0);
      const collected = inMonth.reduce((s, f) => s + (f.amountPaid || 0), 0);
      return {
        month: m,
        expected: Math.round(expected * 100) / 100,
        collected: Math.round(collected * 100) / 100,
      };
    });

    const data = {
      insights: normalizedInsights,
      stats: {
        totalStudents,
        totalClasses,
        overallAttendanceRate,
        feeCollectionRate: payload.feeStats.collectionRate,
      },
      charts: {
        attendanceDistribution: Object.entries(attDist).map(
          ([name, value]) => ({
            name,
            value,
          }),
        ),
        feeDistribution: Object.entries(feeDist).map(([name, value]) => ({
          name,
          value,
        })),
        resultTrend: resultByMonth,
        feeCollectionTrend: feeByMonth,
        classComparison: classStats
          .map((c) => ({
            className: c.className,
            avgScore: c.avgScore,
            avgAttendance: c.avgAttendance,
          }))
          .slice(0, 12),
        subjectPerformance: subjectStats
          .map((s) => ({
            subject: s.subject,
            avgScore: s.avgScore,
            failRate: s.failRate,
          }))
          .slice(0, 12),
      },
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error("Admin analytics error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "AI analysis failed" });
  }
};

// ────────────── TEACHER ──────────────
export const getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const academicYear = req.query.academicYear || currentAcademicYear();

    const teacher = await Teacher.findOne({ userId: teacherId })
      .populate("assignedClasses")
      .lean();

    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: "Teacher profile not found" });
    }

    const classIds = (teacher.assignedClasses || []).map((c) => c._id);

    const [students, results, attendances] = await Promise.all([
      Student.find({ classId: { $in: classIds }, enrollmentStatus: "active" })
        .populate("userId", "name")
        .populate("classId", "name section")
        .lean(),
      Result.find({ classId: { $in: classIds }, academicYear })
        .populate("subjectId", "name")
        .populate("studentId")
        .lean(),
      Attendance.find({
        classId: { $in: classIds },
        date: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
        },
      }).lean(),
    ]);

    // Per-student summary
    const studentSummaries = students.slice(0, 30).map((s) => {
      const sResults = results.filter(
        (r) => String(r.studentId?._id || r.studentId) === String(s._id),
      );
      const sAttendance = attendances.filter(
        (a) => String(a.studentId) === String(s._id),
      );
      const avgScore =
        sResults.length > 0
          ? sResults.reduce((sum, r) => sum + (r.percentage || 0), 0) /
            sResults.length
          : 0;
      const present = sAttendance.filter(
        (a) => a.status === "present" || a.status === "late",
      ).length;
      const attendanceRate =
        sAttendance.length > 0
          ? Math.round((present / sAttendance.length) * 100)
          : 0;
      return {
        name: s.userId?.name || "Unknown",
        class: `${s.classId?.name || ""} ${s.classId?.section || ""}`.trim(),
        avgScore: Math.round(avgScore * 10) / 10,
        attendance: attendanceRate,
        totalExams: sResults.length,
      };
    });

    // Subject difficulty
    const subjectMap = {};
    results.forEach((r) => {
      const sName = r.subjectId?.name || "Unknown";
      if (!subjectMap[sName])
        subjectMap[sName] = { scores: [], fails: 0, total: 0 };
      subjectMap[sName].scores.push(r.percentage || 0);
      subjectMap[sName].total++;
      if (r.status === "Fail") subjectMap[sName].fails++;
    });

    const subjectDifficulty = Object.entries(subjectMap).map(
      ([name, data]) => ({
        subject: name,
        avgScore:
          Math.round(
            (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10,
          ) / 10,
        failCount: data.fails,
        totalStudents: data.total,
      }),
    );

    const payload = {
      teacherName: req.user.name,
      totalStudents: students.length,
      classCount: classIds.length,
      studentSummaries,
      subjectDifficulty,
    };

    const insights = await aiService.getTeacherInsights(payload);

    // Attendance heatmap data (last ~12 weeks)
    const daily = new Map();
    attendances.forEach((a) => {
      const key = new Date(a.date).toISOString().slice(0, 10);
      if (!daily.has(key)) daily.set(key, { date: key, total: 0, present: 0 });
      const d = daily.get(key);
      d.total++;
      if (a.status === "present" || a.status === "late") d.present++;
    });
    const attendanceHeatmap = Array.from(daily.values())
      .map((d) => ({
        date: d.date,
        value: d.total ? Math.round((d.present / d.total) * 100) : 0,
        total: d.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-84);

    const data = {
      insights,
      stats: {
        classCount: classIds.length,
        totalStudents: students.length,
      },
      charts: {
        weakStudents: (insights.weakStudents || []).map((s) => ({
          name: s.name,
          avgScore: s.avgScore,
          attendance: s.attendance,
        })),
        subjectPerformance: subjectDifficulty.map((s) => ({
          subject: s.subject,
          avgScore: s.avgScore,
          failCount: s.failCount,
        })),
        attendanceHeatmap,
      },
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error("Teacher analytics error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "AI analysis failed" });
  }
};

// ────────────── STUDENT ──────────────
export const getStudentAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const academicYear = req.query.academicYear || currentAcademicYear();

    const student = await Student.findOne({ userId })
      .populate("classId", "name section")
      .populate("userId", "name")
      .lean();

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
    }

    const [results, attendances] = await Promise.all([
      Result.find({ studentId: student._id, academicYear })
        .populate("subjectId", "name")
        .lean(),
      Attendance.find({
        studentId: student._id,
        date: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
        },
      })
        .populate("subjectId", "name")
        .lean(),
    ]);

    // Subject-wise performance
    const subjectPerf = {};
    results.forEach((r) => {
      const sName = r.subjectId?.name || "Unknown";
      if (!subjectPerf[sName]) subjectPerf[sName] = [];
      subjectPerf[sName].push({
        examType: r.examType,
        percentage: r.percentage || 0,
        grade: r.grade,
        status: r.status,
      });
    });

    const subjectSummary = Object.entries(subjectPerf).map(([name, exams]) => ({
      subject: name,
      avgScore:
        Math.round(
          (exams.reduce((s, e) => s + e.percentage, 0) / exams.length) * 10,
        ) / 10,
      exams: exams.length,
      latestGrade: exams[exams.length - 1]?.grade || "N/A",
    }));

    // Attendance summary
    const totalClasses = attendances.length;
    const present = attendances.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length;
    const attendanceRate =
      totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0;

    const payload = {
      studentName: student.userId?.name || "Student",
      class:
        `${student.classId?.name || ""} ${student.classId?.section || ""}`.trim(),
      academicYear,
      subjectSummary,
      overallAvg:
        subjectSummary.length > 0
          ? Math.round(
              (subjectSummary.reduce((s, sub) => s + sub.avgScore, 0) /
                subjectSummary.length) *
                10,
            ) / 10
          : 0,
      attendanceRate,
      totalExams: results.length,
    };

    const insights = await aiService.getStudentInsights(payload);

    const months = lastNMonths(6);
    const resultsByMonth = months.map((m) => {
      const inMonth = (results || []).filter(
        (r) => monthKey(r.createdAt) === m,
      );
      const avg =
        inMonth.length > 0
          ? inMonth.reduce((s, r) => s + (r.percentage || 0), 0) /
            inMonth.length
          : 0;
      return {
        month: m,
        avgScore: Math.round(avg * 10) / 10,
        exams: inMonth.length,
      };
    });

    // Attendance trend (by month)
    const attByMonth = months.map((m) => {
      const inMonth = (attendances || []).filter((a) => monthKey(a.date) === m);
      const presentCount = inMonth.filter(
        (a) => a.status === "present" || a.status === "late",
      ).length;
      const rate = inMonth.length
        ? Math.round((presentCount / inMonth.length) * 100)
        : 0;
      return { month: m, attendanceRate: rate, marked: inMonth.length };
    });

    const data = {
      insights,
      stats: {
        overallAvg: payload.overallAvg,
        attendanceRate,
        totalExams: results.length,
      },
      charts: {
        subjectComparison: subjectSummary.map((s) => ({
          subject: s.subject,
          avgScore: s.avgScore,
          latestGrade: s.latestGrade,
        })),
        marksProgression: resultsByMonth,
        attendanceTrend: attByMonth,
      },
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error("Student analytics error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "AI analysis failed" });
  }
};

// ────────────── PARENT ──────────────
export const getParentAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { studentId } = req.query;
    const academicYear = req.query.academicYear || currentAcademicYear();

    const parent = await Parent.findOne({ userId }).lean();
    if (!parent) {
      return res
        .status(404)
        .json({ success: false, message: "Parent profile not found" });
    }

    // Find children
    let children;
    if (studentId) {
      children = await Student.find({
        _id: studentId,
        parentId: parent._id,
        enrollmentStatus: "active",
      })
        .populate("classId", "name section")
        .populate("userId", "name")
        .lean();
    } else {
      children = await Student.find({
        parentId: parent._id,
        enrollmentStatus: "active",
      })
        .populate("classId", "name section")
        .populate("userId", "name")
        .lean();
    }

    if (!children.length) {
      return res.json({
        success: true,
        data: { summary: "No active children found for analysis." },
      });
    }

    const childIds = children.map((c) => c._id);

    const [results, attendances] = await Promise.all([
      Result.find({ studentId: { $in: childIds }, academicYear })
        .populate("subjectId", "name")
        .lean(),
      Attendance.find({
        studentId: { $in: childIds },
        date: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
        },
      }).lean(),
    ]);

    // Per-child summary
    const childData = children.map((child) => {
      const cResults = results.filter(
        (r) => String(r.studentId) === String(child._id),
      );
      const cAtt = attendances.filter(
        (a) => String(a.studentId) === String(child._id),
      );
      const avgScore =
        cResults.length > 0
          ? cResults.reduce((s, r) => s + (r.percentage || 0), 0) /
            cResults.length
          : 0;
      const present = cAtt.filter(
        (a) => a.status === "present" || a.status === "late",
      ).length;
      const attRate =
        cAtt.length > 0 ? Math.round((present / cAtt.length) * 100) : 0;

      // Subject breakdown
      const subjectMap = {};
      cResults.forEach((r) => {
        const sName = r.subjectId?.name || "Unknown";
        if (!subjectMap[sName]) subjectMap[sName] = [];
        subjectMap[sName].push(r.percentage || 0);
      });

      const subjects = Object.entries(subjectMap).map(([name, scores]) => ({
        subject: name,
        avgScore:
          Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
          10,
      }));

      return {
        name: child.userId?.name || "Child",
        class:
          `${child.classId?.name || ""} ${child.classId?.section || ""}`.trim(),
        avgScore: Math.round(avgScore * 10) / 10,
        attendanceRate: attRate,
        totalExams: cResults.length,
        subjects,
      };
    });

    const payload = {
      parentName: req.user.name,
      academicYear,
      children: childData,
    };

    const insights = await aiService.getParentInsights(payload);

    // Trend chart for the first child (if any)
    const months = lastNMonths(6);
    const firstChildId = children[0]?._id;
    const firstChildName = children[0]?.userId?.name;
    const childTrend = firstChildId
      ? months.map((m) => {
          const inMonth = (results || []).filter(
            (r) =>
              String(r.studentId) === String(firstChildId) &&
              monthKey(r.createdAt) === m,
          );
          const avg =
            inMonth.length > 0
              ? inMonth.reduce((s, r) => s + (r.percentage || 0), 0) /
                inMonth.length
              : 0;
          return {
            month: m,
            avgScore: Math.round(avg * 10) / 10,
            exams: inMonth.length,
          };
        })
      : [];

    const childCompare = childData.map((c) => ({
      name: c.name,
      avgScore: c.avgScore,
      attendanceRate: c.attendanceRate,
    }));

    const data = {
      insights,
      stats: {
        childrenCount: childData.length,
      },
      charts: {
        childrenComparison: childCompare,
        firstChildTrend: childTrend,
        firstChildName: firstChildName || null,
      },
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error("Parent analytics error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "AI analysis failed" });
  }
};
