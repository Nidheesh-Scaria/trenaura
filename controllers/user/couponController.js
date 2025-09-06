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
    const myCoupon = await CouponSchema.find({ userId:userId }).lean();
    const user=await userSchema.findById(userId)

    const referalCode=user.referralCode

    const coupon=myCoupon.map(coupon=>{
        return {
            ...coupon,
            expiryDate:new Date(coupon.expiryDate).toLocaleString()

        }
    })

    
    

    return res.render("user/myCoupon", {
      title: "Trenaura coupon",
      adminHeader: true,
      coupon,
      referalCode,
      name: user.name,

    });
  } catch (error) {}
};

module.exports = {
  loadMyCoupon,
};
