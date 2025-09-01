
const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletTopupOrderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
  },
  { timestamps: true }
);

const WalletTopupOrder = mongoose.model("WalletTopupOrder", walletTopupOrderSchema);
module.exports = WalletTopupOrder;
