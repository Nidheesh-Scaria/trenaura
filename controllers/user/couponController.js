const CouponSchema = require("../../models/couponSchema");
const CouponUsageSchema = require("../../models/couponUsageSchema ");
const userSchema = require("../../models/userSchema");

const env = require("dotenv").config();
const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const { default: mongoose } = require("mongoose");

const loadMyCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const myCoupon = await CouponSchema.find({ userId: userId }).lean();
    const user = await userSchema.findById(userId);

    const referalCode = user.referralCode;

    const coupon = myCoupon.map((coupon) => {
      return {
        ...coupon,
        expiryDate: new Date(coupon.expiryDate).toLocaleString(),
      };
    });

    return res.render("user/myCoupon", {
      title: "Trenaura coupon",
      adminHeader: true,
      coupon,
      referalCode,
      name: user.name,
    });
  } catch (error) {
    console.error("Error in loadMyCoupon:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

module.exports = {
  loadMyCoupon,
};
