import Fee from "../models/fee.model.js";
import FeeStructure from "../models/feeStructure.model.js";
import Payment from "../models/payment.model.js";
import Student from "../models/student.model.js";
import Parent from "../models/parent.model.js";
import mongoose from "mongoose";

// ═══════════════════════════════════════════════════
// FEE STRUCTURE ENDPOINTS (ADMIN)
// ═══════════════════════════════════════════════════

/**
 * Create a fee structure
 * @route POST /api/fees/structures
 */
export const createFeeStructure = async (req, res) => {
  try {
    const { name, feeType, description, amount, classId, academicYear, dueDate, frequency } = req.body;

    const structure = await FeeStructure.create({
      name,
      feeType,
      description,
      amount,
      classId,
      academicYear,
      dueDate,
      frequency: frequency || "one-time",
      createdBy: req.user._id,
    });

    const populated = await FeeStructure.findById(structure._id)
      .populate("classId", "name section")
      .populate("createdBy", "name");

    res.status(201).json({
      success: true,
      message: "Fee structure created successfully",
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to create fee structure" });
  }
};

/**
 * Get all fee structures
 * @route GET /api/fees/structures
 */
export const getAllFeeStructures = async (req, res) => {
  try {
    const { classId, academicYear, feeType, isActive } = req.query;
    const query = {};
    if (classId) query.classId = classId;
    if (academicYear) query.academicYear = academicYear;
    if (feeType) query.feeType = feeType;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const structures = await FeeStructure.find(query)
      .populate("classId", "name section")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: structures.length, data: structures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch fee structures" });
  }
};

/**
 * Update a fee structure
 * @route PUT /api/fees/structures/:id
 */
export const updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const structure = await FeeStructure.findByIdAndUpdate(id, req.body, { new: true, runValidators: true })
      .populate("classId", "name section");

    if (!structure) {
      return res.status(404).json({ success: false, message: "Fee structure not found" });
    }

    res.status(200).json({ success: true, message: "Fee structure updated", data: structure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to update fee structure" });
  }
};

/**
 * Delete a fee structure
 * @route DELETE /api/fees/structures/:id
 */
export const deleteFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const structure = await FeeStructure.findByIdAndDelete(id);
    if (!structure) {
      return res.status(404).json({ success: false, message: "Fee structure not found" });
    }
    res.status(200).json({ success: true, message: "Fee structure deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to delete fee structure" });
  }
};

/**
 * Toggle fee structure active status
 * @route PATCH /api/fees/structures/:id/toggle
 */
export const toggleFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const structure = await FeeStructure.findById(id);
    if (!structure) {
      return res.status(404).json({ success: false, message: "Fee structure not found" });
    }
    structure.isActive = !structure.isActive;
    await structure.save();

    res.status(200).json({ success: true, message: `Fee structure ${structure.isActive ? "activated" : "deactivated"}`, data: structure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to toggle fee structure" });
  }
};

// ═══════════════════════════════════════════════════
// FEE ASSIGNMENT ENDPOINTS (ADMIN)
// ═══════════════════════════════════════════════════

/**
 * Assign fees to students based on a fee structure (bulk)
 * @route POST /api/fees/assign
 */
export const assignFeesToClass = async (req, res) => {
  try {
    const { feeStructureId } = req.body;

    const structure = await FeeStructure.findById(feeStructureId);
    if (!structure) {
      return res.status(404).json({ success: false, message: "Fee structure not found" });
    }

    // Get all active students in the class
    const students = await Student.find({
      classId: structure.classId,
      academicYear: structure.academicYear,
      enrollmentStatus: "active",
    });

    if (students.length === 0) {
      return res.status(400).json({ success: false, message: "No active students found in this class" });
    }

    const created = [];
    const skipped = [];

    for (const student of students) {
      // Check if fee already assigned
      const existing = await Fee.findOne({
        studentId: student._id,
        feeType: structure.feeType,
        academicYear: structure.academicYear,
        description: structure.name,
      });

      if (existing) {
        skipped.push({ studentId: student._id, reason: "Already assigned" });
        continue;
      }

      const fee = await Fee.create({
        studentId: student._id,
        feeType: structure.feeType,
        description: structure.name,
        amount: structure.amount,
        dueDate: structure.dueDate,
        academicYear: structure.academicYear,
      });

      created.push(fee);
    }

    res.status(201).json({
      success: true,
      message: `Fees assigned to ${created.length} students (${skipped.length} skipped)`,
      data: { created: created.length, skipped: skipped.length, skippedDetails: skipped },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to assign fees" });
  }
};

// ═══════════════════════════════════════════════════
// FEE CRUD ENDPOINTS (ADMIN)
// ═══════════════════════════════════════════════════

/**
 * Create a single fee entry
 * @route POST /api/fees
 */
export const createFee = async (req, res) => {
  try {
    const { studentId, feeType, amount, discount, fine, dueDate, academicYear, period, description } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const fee = await Fee.create({
      studentId,
      feeType,
      amount,
      discount: discount || 0,
      fine: fine || 0,
      dueDate,
      academicYear: academicYear || student.academicYear,
      period,
      description,
    });

    const populatedFee = await Fee.findById(fee._id).populate({
      path: "studentId",
      select: "admissionNumber rollNumber section classId",
      populate: [
        { path: "userId", select: "name email phone" },
        { path: "classId", select: "name section" },
      ],
    });

    res.status(201).json({ success: true, message: "Fee created successfully", data: populatedFee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to create fee" });
  }
};

/**
 * Create bulk fee entries
 * @route POST /api/fees/bulk
 */
export const createBulkFees = async (req, res) => {
  try {
    const { studentIds, feeType, amount, discount, dueDate, academicYear, period, description } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: "Student IDs array is required" });
    }

    const createdFees = [];
    const errors = [];

    for (const studentId of studentIds) {
      try {
        const existing = await Fee.findOne({ studentId, feeType, academicYear, period });
        if (existing) {
          errors.push({ studentId, message: "Fee entry already exists" });
          continue;
        }
        const newFee = await Fee.create({
          studentId, feeType, amount, discount: discount || 0, dueDate, academicYear, period, description,
        });
        createdFees.push(newFee);
      } catch (err) {
        errors.push({ studentId, message: err.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdFees.length} fee entries`,
      data: { created: createdFees.length, errors: errors.length, errorDetails: errors },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to create bulk fees" });
  }
};

/**
 * Get all fees with filters
 * @route GET /api/fees
 */
export const getAllFees = async (req, res) => {
  try {
    const { feeType, paymentStatus, academicYear, period, classId, search } = req.query;

    const query = {};
    if (feeType) query.feeType = feeType;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (academicYear) query.academicYear = academicYear;
    if (period) query.period = period;

    let fees = await Fee.find(query)
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber section classId",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "classId", select: "name section" },
        ],
      })
      .populate("collectedBy", "name")
      .sort({ createdAt: -1 });

    // Filter by class if provided
    if (classId) {
      fees = fees.filter((fee) => fee.studentId?.classId?._id?.toString() === classId);
    }

    // Filter by search (student name)
    if (search) {
      const lowerSearch = search.toLowerCase();
      fees = fees.filter(
        (fee) =>
          fee.studentId?.userId?.name?.toLowerCase().includes(lowerSearch) ||
          fee.studentId?.admissionNumber?.toLowerCase().includes(lowerSearch)
      );
    }

    res.status(200).json({ success: true, count: fees.length, data: fees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch fees" });
  }
};

/**
 * Get fees by student
 * @route GET /api/fees/student/:studentId
 */
export const getFeesByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { feeType, paymentStatus, academicYear } = req.query;

    // Authorization check
    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student || student._id.toString() !== studentId) {
        return res.status(403).json({ success: false, message: "You can only view your own fees" });
      }
    } else if (req.user.role === "parent") {
      const parent = await Parent.findOne({ userId: req.user._id });
      if (!parent || !parent.children.some((c) => c.toString() === studentId)) {
        return res.status(403).json({ success: false, message: "You can only view your children's fees" });
      }
    }

    const query = { studentId };
    if (feeType) query.feeType = feeType;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (academicYear) query.academicYear = academicYear;

    const fees = await Fee.find(query)
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber section classId",
        populate: [
          { path: "userId", select: "name email" },
          { path: "classId", select: "name section" },
        ],
      })
      .sort({ dueDate: -1 });

    const summary = {
      totalAmount: fees.reduce((sum, f) => sum + f.totalAmount, 0),
      totalPaid: fees.reduce((sum, f) => sum + f.amountPaid, 0),
      totalBalance: fees.reduce((sum, f) => sum + f.balanceDue, 0),
      totalFees: fees.length,
      paidCount: fees.filter((f) => f.paymentStatus === "paid").length,
      unpaidCount: fees.filter((f) => f.paymentStatus === "unpaid").length,
      partialCount: fees.filter((f) => f.paymentStatus === "partial").length,
      overdueCount: fees.filter((f) => f.paymentStatus === "overdue").length,
    };

    res.status(200).json({ success: true, count: fees.length, summary, data: fees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch fees" });
  }
};

/**
 * Get my fees (for logged-in student)
 * @route GET /api/fees/my
 */
export const getMyFees = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const { feeType, paymentStatus, academicYear } = req.query;

    const query = { studentId: student._id };
    if (feeType) query.feeType = feeType;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (academicYear) query.academicYear = academicYear;

    const fees = await Fee.find(query).sort({ dueDate: -1 });

    const summary = {
      totalAmount: fees.reduce((sum, f) => sum + f.totalAmount, 0),
      totalPaid: fees.reduce((sum, f) => sum + f.amountPaid, 0),
      totalBalance: fees.reduce((sum, f) => sum + f.balanceDue, 0),
      totalFees: fees.length,
      paidCount: fees.filter((f) => f.paymentStatus === "paid").length,
      unpaidCount: fees.filter((f) => f.paymentStatus === "unpaid").length,
      overdueCount: fees.filter((f) => f.paymentStatus === "overdue").length,
    };

    res.status(200).json({ success: true, count: fees.length, summary, data: fees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch fees" });
  }
};

// ═══════════════════════════════════════════════════
// PAYMENT ENDPOINTS
// ═══════════════════════════════════════════════════

/**
 * Record payment (Admin records offline payment)
 * @route POST /api/fees/:id/pay
 */
export const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid, paymentMethod, transactionRef, remarks } = req.body;

    const fee = await Fee.findById(id);
    if (!fee) {
      return res.status(404).json({ success: false, message: "Fee not found" });
    }

    if (amountPaid <= 0) {
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0" });
    }

    if (amountPaid > fee.balanceDue) {
      return res.status(400).json({ success: false, message: `Payment amount cannot exceed balance due (${fee.balanceDue})` });
    }

    // Create payment record
    const payment = await Payment.create({
      feeId: fee._id,
      studentId: fee.studentId,
      amount: amountPaid,
      paymentMethod: paymentMethod || "cash",
      transactionRef,
      paidBy: "admin",
      paidByUserId: req.user._id,
      collectedBy: req.user._id,
      remarks,
    });

    // Update fee
    fee.amountPaid += amountPaid;
    fee.paymentMethod = paymentMethod || "cash";
    fee.transactionRef = transactionRef;
    fee.paidDate = new Date();
    fee.collectedBy = req.user._id;

    if (fee.amountPaid >= fee.totalAmount) {
      fee.paymentStatus = "paid";
      fee.balanceDue = 0;
      fee.receiptNumber = payment.receiptNumber;
    } else {
      fee.paymentStatus = "partial";
      fee.balanceDue = fee.totalAmount - fee.amountPaid;
    }

    await fee.save();

    const populatedFee = await Fee.findById(id).populate({
      path: "studentId",
      select: "admissionNumber rollNumber section",
      populate: { path: "userId", select: "name email" },
    });

    res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: { fee: populatedFee, payment },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to record payment" });
  }
};

/**
 * Parent makes a payment (simulated online)
 * @route POST /api/fees/:id/parent-pay
 */
export const parentPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid, paymentMethod, transactionRef } = req.body;

    const fee = await Fee.findById(id).populate("studentId");
    if (!fee) {
      return res.status(404).json({ success: false, message: "Fee not found" });
    }

    // Verify parent owns this student
    const parent = await Parent.findOne({ userId: req.user._id });
    if (!parent || !parent.children.some((c) => c.toString() === fee.studentId._id.toString())) {
      return res.status(403).json({ success: false, message: "You can only pay fees for your children" });
    }

    if (amountPaid <= 0) {
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0" });
    }

    if (amountPaid > fee.balanceDue) {
      return res.status(400).json({ success: false, message: `Payment amount cannot exceed balance due (${fee.balanceDue})` });
    }

    // Create payment record
    const payment = await Payment.create({
      feeId: fee._id,
      studentId: fee.studentId._id,
      amount: amountPaid,
      paymentMethod: paymentMethod || "online",
      transactionRef: transactionRef || `TXN-${Date.now()}`,
      paidBy: "parent",
      paidByUserId: req.user._id,
    });

    // Update fee
    fee.amountPaid += amountPaid;
    fee.paymentMethod = paymentMethod || "online";
    fee.transactionRef = payment.transactionRef;
    fee.paidDate = new Date();

    if (fee.amountPaid >= fee.totalAmount) {
      fee.paymentStatus = "paid";
      fee.balanceDue = 0;
      fee.receiptNumber = payment.receiptNumber;
    } else {
      fee.paymentStatus = "partial";
      fee.balanceDue = fee.totalAmount - fee.amountPaid;
    }

    await fee.save();

    const populatedFee = await Fee.findById(id).populate({
      path: "studentId",
      select: "admissionNumber rollNumber section",
      populate: { path: "userId", select: "name email" },
    });

    res.status(200).json({
      success: true,
      message: "Payment processed successfully",
      data: { fee: populatedFee, payment },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to process payment" });
  }
};

/**
 * Get payment history for a student
 * @route GET /api/fees/payments/:studentId
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Authorization
    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student || student._id.toString() !== studentId) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }
    } else if (req.user.role === "parent") {
      const parent = await Parent.findOne({ userId: req.user._id });
      if (!parent || !parent.children.some((c) => c.toString() === studentId)) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }
    }

    const payments = await Payment.find({ studentId, status: "success" })
      .populate({
        path: "feeId",
        select: "feeType description totalAmount academicYear",
      })
      .populate("collectedBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch payment history" });
  }
};

/**
 * Get all payments (Admin)
 * @route GET /api/fees/payments
 */
export const getAllPayments = async (req, res) => {
  try {
    const { paymentMethod, status, startDate, endDate } = req.query;
    const query = {};
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber",
        populate: { path: "userId", select: "name email" },
      })
      .populate({
        path: "feeId",
        select: "feeType description totalAmount academicYear",
      })
      .populate("collectedBy", "name")
      .populate("paidByUserId", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch payments" });
  }
};

// ═══════════════════════════════════════════════════
// UPDATE / DELETE FEE (ADMIN)
// ═══════════════════════════════════════════════════

/**
 * Update a fee (Admin – apply discount/fine/dueDate)
 * @route PUT /api/fees/:id
 */
export const updateFee = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, discount, fine, dueDate, description, remarks } = req.body;

    const fee = await Fee.findById(id);
    if (!fee) {
      return res.status(404).json({ success: false, message: "Fee not found" });
    }

    if (fee.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Cannot update a fully paid fee" });
    }

    if (amount !== undefined) fee.amount = amount;
    if (discount !== undefined) fee.discount = discount;
    if (fine !== undefined) fee.fine = fine;
    if (dueDate !== undefined) fee.dueDate = dueDate;
    if (description !== undefined) fee.description = description;
    if (remarks !== undefined) fee.remarks = remarks;

    fee.totalAmount = fee.amount - fee.discount + fee.fine;
    fee.balanceDue = fee.totalAmount - fee.amountPaid;

    await fee.save();

    const populatedFee = await Fee.findById(id).populate({
      path: "studentId",
      select: "admissionNumber rollNumber section",
      populate: { path: "userId", select: "name email" },
    });

    res.status(200).json({ success: true, message: "Fee updated successfully", data: populatedFee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to update fee" });
  }
};

/**
 * Delete a fee
 * @route DELETE /api/fees/:id
 */
export const deleteFee = async (req, res) => {
  try {
    const { id } = req.params;
    const fee = await Fee.findById(id);
    if (!fee) {
      return res.status(404).json({ success: false, message: "Fee not found" });
    }
    if (fee.amountPaid > 0) {
      return res.status(400).json({ success: false, message: "Cannot delete a fee with recorded payments" });
    }
    await Fee.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Fee deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to delete fee" });
  }
};

// ═══════════════════════════════════════════════════
// ANALYTICS & STATS (ADMIN)
// ═══════════════════════════════════════════════════

/**
 * Get comprehensive fee statistics
 * @route GET /api/fees/stats/summary
 */
export const getFeeStats = async (req, res) => {
  try {
    const { academicYear, classId } = req.query;

    const matchQuery = {};
    if (academicYear) matchQuery.academicYear = academicYear;

    // Overall stats
    const stats = await Fee.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      ...(classId
        ? [{ $match: { "student.classId": new mongoose.Types.ObjectId(classId) } }]
        : []),
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          totalCollected: { $sum: "$amountPaid" },
          totalPending: { $sum: "$balanceDue" },
          totalFees: { $sum: 1 },
          paidCount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
          partialCount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "partial"] }, 1, 0] } },
          unpaidCount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "unpaid"] }, 1, 0] } },
          overdueCount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "overdue"] }, 1, 0] } },
        },
      },
    ]);

    // Stats by fee type
    const statsByType = await Fee.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$feeType",
          totalAmount: { $sum: "$totalAmount" },
          totalCollected: { $sum: "$amountPaid" },
          totalPending: { $sum: "$balanceDue" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Recent payments
    const recentPayments = await Payment.find({ status: "success" })
      .populate({
        path: "studentId",
        select: "admissionNumber",
        populate: { path: "userId", select: "name" },
      })
      .populate({ path: "feeId", select: "feeType description" })
      .sort({ createdAt: -1 })
      .limit(10);

    // Defaulters (students with overdue fees)
    const defaulters = await Fee.find({ paymentStatus: "overdue" })
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber classId",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "classId", select: "name section" },
        ],
      })
      .sort({ dueDate: 1 })
      .limit(20);

    // Collection trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const collectionTrend = await Payment.aggregate([
      { $match: { status: "success", createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          totalCollected: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overall: stats[0] || {
          totalAmount: 0,
          totalCollected: 0,
          totalPending: 0,
          totalFees: 0,
          paidCount: 0,
          partialCount: 0,
          unpaidCount: 0,
          overdueCount: 0,
        },
        byFeeType: statsByType,
        recentPayments,
        defaulters,
        collectionTrend,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch fee statistics" });
  }
};

/**
 * Get receipt by payment ID
 * @route GET /api/fees/receipt/:paymentId
 */
export const getReceipt = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate({
        path: "studentId",
        select: "admissionNumber rollNumber classId",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "classId", select: "name section" },
        ],
      })
      .populate({
        path: "feeId",
        select: "feeType description amount totalAmount academicYear dueDate",
      })
      .populate("paidByUserId", "name role")
      .populate("collectedBy", "name");

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // Authorization
    if (req.user.role === "parent") {
      const parent = await Parent.findOne({ userId: req.user._id });
      if (!parent || !parent.children.some((c) => c.toString() === payment.studentId._id.toString())) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch receipt" });
  }
};
