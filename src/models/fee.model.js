import mongoose from "mongoose";

/**
 * Fee Model
 * Purpose: Tracks student fee records.
 */
const feeSchema = new mongoose.Schema(
  {
    // Student ID - Student reference
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student is required"],
      index: true,
    },
    // Fee Type - Tuition / Exam / Transport / Library / Lab / Other
    feeType: {
      type: String,
      enum: {
        values: [
          "tuition",
          "exam",
          "transport",
          "fine",
          "library",
          "lab",
          "admission",
          "sports",
          "other",
        ],
        message: "{VALUE} is not a valid fee type",
      },
      required: [true, "Fee type is required"],
    },
    // Fee Description
    description: {
      type: String,
      trim: true,
      default: null,
    },
    // Amount - Fee amount
    amount: {
      type: Number,
      required: [true, "Fee amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    // Discount
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    // Fine/Late Fee
    fine: {
      type: Number,
      default: 0,
      min: [0, "Fine cannot be negative"],
    },
    // Total Amount (amount - discount + fine)
    totalAmount: {
      type: Number,
      default: 0,
    },
    // Due Date - Payment deadline
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    // Payment Status - Paid / Unpaid / Partial / Overdue
    paymentStatus: {
      type: String,
      enum: {
        values: ["paid", "unpaid", "partial", "overdue"],
        message: "{VALUE} is not a valid payment status",
      },
      default: "unpaid",
    },
    // Amount Paid
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
    },
    // Balance Due
    balanceDue: {
      type: Number,
      default: 0,
    },
    // Paid Date - Date of payment
    paidDate: {
      type: Date,
      default: null,
    },
    // Payment Method
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "bank-transfer", "online", "cheque", null],
      default: null,
    },
    // Transaction Reference
    transactionRef: {
      type: String,
      trim: true,
      default: null,
    },
    // Academic Year
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },
    // Month/Period (for monthly fees)
    period: {
      type: String,
      trim: true,
      default: null,
    },
    // Receipt Number
    receiptNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allows multiple null values
      default: null,
    },
    // Remarks
    remarks: {
      type: String,
      trim: true,
      default: null,
    },
    // Collected By
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt
  },
);

// Pre-save middleware to calculate totals
feeSchema.pre("save", function (next) {
  // Calculate total amount
  this.totalAmount = this.amount - this.discount + this.fine;

  // Calculate balance due
  this.balanceDue = this.totalAmount - this.amountPaid;

  // Update payment status based on amounts
  if (this.amountPaid >= this.totalAmount) {
    this.paymentStatus = "paid";
    this.balanceDue = 0;
  } else if (this.amountPaid > 0) {
    this.paymentStatus = "partial";
  } else if (new Date() > this.dueDate && this.paymentStatus === "unpaid") {
    this.paymentStatus = "overdue";
  }
});

// Index for efficient querying
feeSchema.index({ studentId: 1, academicYear: 1 });
feeSchema.index({ paymentStatus: 1, dueDate: 1 });
feeSchema.index({ feeType: 1, academicYear: 1 });

const Fee = mongoose.model("Fee", feeSchema);

export default Fee;
