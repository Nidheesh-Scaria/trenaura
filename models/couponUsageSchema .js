const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponUsageSchema = new Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const CouponUsage = mongoose.model("CouponUsage", couponUsageSchema);

module.exports = CouponUsage;
