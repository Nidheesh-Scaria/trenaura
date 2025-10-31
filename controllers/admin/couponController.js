const CouponSchema = require("../../models/couponSchema");
const CouponUsageSchema = require("../../models/couponUsageSchema ");

const env = require("dotenv").config();
const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const { default: mongoose } = require("mongoose");

const loadCoupon = async (req, res) => {
  try {
    const coupons = await CouponSchema.find().sort({createdAt:-1}).lean();
  
    coupons.forEach((c) => {
      const d = new Date(c.expiryDate);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();

      c.expiryDateFormatted = `${day}-${month}-${year}`;
    });

    return res.render("admin/coupon", {
      hideHeader: true,
      hideFooter: true,
      coupons,
    });
  } catch (error) {
    console.error("Error in loadCoupon", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minOrderValue,
      couponExpiry,
      usageLimit,
      maxDiscount,
    } = req.body;

    const exists = await CouponSchema.findOne({ code });
    if (exists) {
      return res.json({
        mesage: MESSAGES.COUPON.COUPON_EXISTS || "Coupon already exists",
      });
    }

    const coupon = await CouponSchema.create({
      code,
      discountType,
      discountValue,
      minOrderValue,
      expiryDate: couponExpiry,
      usageLimit,
      maxDiscount,
    });

    return res
      .status(httpStatus.OK)
      .json({
        message: MESSAGES.COUPON.COUPON_ADDED || "Coupon addedd successfuly",
      });
  } catch (error) {
    console.error("Error in createCoupon", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    await CouponSchema.findByIdAndDelete(couponId);
    return res
      .status(httpStatus.OK)
      .json({
        message: MESSAGES.COUPON.COUPON_DLTD || "Coupon deleted succesfully",
      });
  } catch (error) {
    console.error("Error in deleteCoupon", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const editCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      couponCode,
      discountType,
      discountValue,
      minOrderValue,
      couponExpiry,
      usageLimit,
      isActive,
    } = req.body;

    const updatedCoupon = await CouponSchema.findByIdAndUpdate(
      id,
      {
        $set: {
          code: couponCode,
          discountType,
          discountValue,
          minOrderValue,
          expiryDate: couponExpiry,
          usageLimit,
        },
      },
      { new: true }
    );

    if (new Date(couponExpiry) < new Date() || usageLimit <= 0) {
      updatedCoupon.isActive = false;
      await updatedCoupon.save();
    }

    return res
      .status(httpStatus.OK)
      .json({
        message: MESSAGES.COUPON.COUPON_UPDTD || "Updated successfully",
        coupon: updatedCoupon,
      });
  } catch (error) {
    console.error("Error in addEditCoupon", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

module.exports = {
  loadCoupon,
  createCoupon,
  deleteCoupon,
  editCoupon,
};
