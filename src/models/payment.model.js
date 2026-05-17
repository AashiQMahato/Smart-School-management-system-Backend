import mongoose from "mongoose";

/**
 * Payment Model
 * Records individual payment transactions against student fees.
 * Supports partial payments, multiple payment methods, and receipt generation.
 */
const paymentSchema = new mongoose.Schema(
  {
    feeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fee",
      required: [true, "Fee reference is required"],
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student reference is required"],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [1, "Payment amount must be greater than 0"],
    },
    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "card",
        "bank-transfer",
        "online",
        "cheque",
        "upi",
        "wallet",
      ],
      required: [true, "Payment method is required"],
    },
    transactionRef: {
      type: String,
      trim: true,
      default: null,
    },
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    paidBy: {
      type: String,
      enum: ["parent", "admin"],
      required: true,
    },
    paidByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["success", "pending", "failed", "refunded"],
      default: "success",
    },
  },
  {
    timestamps: true,
  },
);

// Generate receipt number before save
paymentSchema.pre("save", function (next) {
  if (!this.receiptNumber) {
    this.receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }

});

paymentSchema.index({ studentId: 1, createdAt: -1 });
paymentSchema.index({ feeId: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
