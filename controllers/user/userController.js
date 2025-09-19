const userSchema = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const WalletTopupOrder = require("../../models/walletTopupOrderSchema ");
const Coupon = require("../../models/couponSchema");
const Brand = require("../../models/brandSchema");

const bcrypt = require("bcrypt");
const saltRounds = 10;
const nodeMailer = require("nodemailer");
const { isLoggedIn } = require("../../middleware/userAuth");
const env = require("dotenv").config();
const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const { default: mongoose } = require("mongoose");
const razorpay = require("../../config/razorpay");
const razorpayInstance = require("../../config/razorpay");
const crypto = require("crypto");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodeMailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your Trenaura account",
      text: `Your otp is ${otp}`,
      html: `<b> Your Otp:${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}
//generating referal code
function generateReferralCode(name) {
  const random = Math.floor(1000 + Math.random() * 9000);
  return name.toUpperCase().substring(0, 4) + random;
}

function generateCouponCode(name) {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${name.substring(0, 3).toUpperCase()}-${random}`;
}

const signup = async (req, res) => {
  try {
    let { name, email, phone, password, referralCode } = req.body;

    const existingEmail = await userSchema.findOne({ email });
    const existingPhone = await userSchema.findOne({ phone });

    if (referralCode) {
      const isReferalcode = await userSchema.findOne({ referralCode });
      if (!isReferalcode) {
        return res.redirect(
          "/signup?message=" +
            encodeURIComponent(MESSAGES.NO_REFERRAL_CODE) +
            "&t=" +
            Date.now()
        );
      }
    }

    if (existingEmail || existingPhone) {
      return res.redirect(
        "/signup?message=" +
          encodeURIComponent(MESSAGES.ALREADY_EXISTS) +
          "&t=" +
          Date.now()
      );
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json("email-error");
    }
    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
    req.session.userData = { name, email, phone, password, referralCode };
    res.redirect("/verifyOtp");

    console.log("Otp Sent:", otp);
  } catch (error) {
    console.error("Error in signup", error);
    res.redirect("/pageNotFound");
  }
};

const verifySignupOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Entered Otp: ", otp);
    console.log("Session OTP:", req.session.userOtp);

    if (Date.now() > req.session.otpExpiresAt) {
      delete req.session.userOtp;
      delete req.session.otpExpiresAt;
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "OTP expired. Please resend OTP." });
    }

    if (String(otp) === String(req.session.userOtp)) {
      const user = req.session.userData; //getting data of user
      const hashedPassword = await bcrypt.hash(user.password, saltRounds);

      const saveUserData = new userSchema({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: hashedPassword,
        referralCode: generateReferralCode(user.name),
        referredBy: user.referralCode || null,
      });

      await saveUserData.save();
      let referralCode = user.referralCode;
      let name = user.name;
      if (referralCode) {
        const referrer = await userSchema.findOne({ referralCode });

        if (referrer) {
          referrer.redeemedUser.push(saveUserData._id);
          await referrer.save();

          const coupon = new Coupon({
            code: generateCouponCode(name),
            discountType: "flat",
            discountValue: 200,
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            userId: referrer._id,
          });
          await coupon.save();
        } else {
          return res
            .status(httpStatus.BAD_REQUEST)
            .json({ message: "No referral code found" });
        }
      }

      req.session.user = saveUserData._id;
      req.session.isLoggedIn = true;

      console.log("User registered successfully.");

      // res.redirect("/");
      res.status(httpStatus.OK).json({ success: true, redirectUrl: "/" });
    } else {
      res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: MESSAGES.INVALID_OTP });
    }
  } catch (error) {
    console.error("Error in verifying the OTP", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const resendSignupOtp = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message:
          MESSAGES.EXPIRED_SESSION || "Session expired. Please login again.",
      });
    }

    const { email } = req.session.userData;

    if (!email) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 5 * 60 * 1000; // reset expiry time

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log("Resend Otp:", otp);
      // req.session.touch(); // Refresh session
      res
        .status(httpStatus.OK)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error resending OTP", error.message);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "Internal server error. Please try later.",
    });
  }
};

const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    const user = await userSchema.findOne({ email }).select("+password");

    if (!user || !user.password) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    if (user.isBlocked) {
      req.flash("error", "Sorry you are blocked by admin");
      return res.redirect("/login");
    }
    if (user.isAdmin) {
      req.flash("error", "Sorry you cant login");
      return res.redirect("/login");
    }

    req.session.user = user._id;
    req.session.isLoggedIn = true;
    req.session.userBlocked = user.isBlocked;
    res.redirect("/");
  } catch (error) {
    console.error("Error in saving user", error);
    req.flash("error", "Sorry, login failed. Please try again.");
    return res.redirect("/login");
  }
};

const loadTrenauraHomepage = async (req, res) => {
  try {
    return res.render("user/trenaura", {
      title: "Trenaura Login page",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in rendering home page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user || req.user;
    const isBlocked = req.session.isBlocked || req.isBlocked;

    const userOk = await userSchema.findById(user);
    const categories = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    const mensCategory = await Category.findOne({ name: "Mens" });
    const womensCategory = await Category.findOne({ name: "Womens" });
    const beautyCategory = await Category.findOne({ name: "Beauty" });

    const mensProduct = mensCategory
      ? await Product.findOne({ category: mensCategory._id })
      : null;
    const womensProduct = womensCategory
      ? await Product.findOne({ category: womensCategory._id })
      : null;
    const beautyProduct = beautyCategory
      ? await Product.findOne({ category: beautyCategory._id })
      : null;

    let productData = await Product.find({
      isBlocked: false,
      isDeleted: false,
      isActive: true,
      category: { $in: categories.map((category) => category._id) },
      brand: { $in: brand.map((brand) => brand._id) },
      $or: [{ size: { $ne: [] } }, { quantity: { $lt: 0 } }],
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const randomImages = (images) => {
      if (!images || images.length == 0) return null;
      const randomIndex = Math.floor(Math.random() * images.length);
      return images[randomIndex];
    };

    return res.render("user/home", {
      title: "Trenaura - Home page",
      isLoggedIn: !!user,
      adminHeader: true,
      products: productData,
      mensImg: mensProduct?.productImages?.[0]
        ? `/images/${randomImages(mensProduct.productImages)}`
        : "default.jpg",
      womensImg: womensProduct?.productImages?.[0]
        ? `/images/${randomImages(womensProduct.productImages)}`
        : "default.jpg",
      beautyImg: beautyProduct?.productImages?.[0]
        ? `/images/${randomImages(beautyProduct.productImages)}`
        : "default.jpg",
    });
  } catch (error) {
    console.error("Error in rendering home page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const loadShop = async (req, res) => {
  try {
    const user = req.session.user;
    const {
      category,
      price,
      brand,
      sort,
      search,
      page = 1,
      limit = 12,
    } = req.query;

    let isFilter = false;
    let categoryName;
    let brandName;
    const skip = (page - 1) * limit;

    let filter = {
      isBlocked: false,
      isDeleted: false,
      isActive: true,
      size: { $ne: [] },
    };

    if (category && category !== "all") {
      categoryName = await Category.findById(category).lean();
      categoryName = categoryName.name;
      filter.category = category;
      isFilter = true;
    }

    if (price) {
      let priceRange = price.split("-");
      if (priceRange.length === 2) {
        filter.salePrice = {
          $gte: parseInt(priceRange[0]),
          $lte: parseInt(priceRange[1]),
        };
      } else if (price.includes("+")) {
        filter.salePrice = { $gte: parseInt(price) };
      }
      isFilter = true;
    }

    let selectedBrands = [];
    let brandNames = [];

    if (brand) {
      if (Array.isArray(brand)) {
        selectedBrands = brand;
        const brandDocs = await Brand.find({ _id: { $in: brand } }).lean();
        brandNames = brandDocs.map((b) => b.brandName);
        filter.brand = { $in: brand };
      } else {
        selectedBrands = [brand];
        const brandDoc = await Brand.findById(brand).lean();
        if (brandDoc) brandNames = [brandDoc.brandName];
        filter.brand = brand;
      }
      isFilter = true;
    }

    if (search && search.trim() !== "") {
      isFilter = true;
      filter.productName = { $regex: search, $options: "i" };
    }

    let sortOption = {};

    switch (sort) {
      case "low-high":
        sortOption.salePrice = 1;
        break;
      case "high-low":
        sortOption.salePrice = -1;
        break;
      case "newest":
        sortOption.createdAt = -1;
        break;
      default:
        sortOption = {};
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const categories = await Category.find({ isListed: true }).lean();
    const brands = await Brand.find({ isBlocked: false }).lean();

    return res.render("user/shop", {
      title: "Trenaura - Shop page",
      isLoggedIn: !!user,
      adminHeader: true,
      products,
      categories,
      brands,
      category: categoryName,
      price,
      brand: brandNames,
      search,
      sort,
      currentPage: parseInt(page),
      totalPages,
      isFilter,
    });
  } catch (error) {
    console.error("Error in rendering shop page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const loadLogin = async (req, res) => {
  try {
    const blockMsg = req.cookies?.blockMessage;
    if (blockMsg) {
      req.flash("error", blockMsg);
      res.clearCookie("blockMessage");
    }

    return res.render("user/login", {
      title: "Trenaura Login page",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
      messages: req.flash("error"),
    });
  } catch (error) {
    console.error("Error in rendering login page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("user/page-404", {
      title: "Trenaura-Page not found",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    res.redirect("/pageNotfound");
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render("user/signup", {
      title: "Trenaura Signup page",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
      message: req.query.message,
    });
  } catch (error) {
    console.error("Error in rendering signup page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const verifyOtp = async (req, res) => {
  try {
    return res.render("user/veryfyOtp", {
      title: "Trenaura verifyOtp",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in verfyOtp :", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).send("Server error");
      }
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Error in logout:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const loadLogout = async (req, res) => {
  try {
    res.redirect("/login");
  } catch (error) {
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const forgotPassword = async (req, res) => {
  try {
    return res.render("user/forgotPswdMail", {
      title: "Forgot password",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
      messages: req.flash("error"),
    });
  } catch (error) {
    console.error("Error in rendering login page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const forgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userSchema.findOne({ email });
    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ success: false, message: "User not found with this email" });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Failed to send email" });
    }

    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
    req.session.userData = { email };

    console.log("OTP sent:", otp);

    res.render("user/verifyOtpPswd", {
      title: "Trenaura Verify OTP",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in forgotPasswordOtp:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;
    const otpExpiresAt = req.session.otpExpiresAt;

    if (!sessionOtp || !otpExpiresAt) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "OTP session expired or invalid." });
    }

    if (Date.now() > otpExpiresAt) {
      delete req.session.userOtp;
      delete req.session.otpExpiresAt;
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    if (String(otp) === String(sessionOtp)) {
      req.session.userData = { email: req.session.userData.email };

      return res
        .status(httpStatus.OK)
        .json({ success: true, redirectUrl: "/change-password" });
    } else {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error in verifyForgotPasswordOtp:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "An error occurred." });
  }
};

const loadForgotPassword = async (req, res) => {
  try {
    return res.render("user/forgotPassword", {
      title: "Forgot password",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in verfyOtp :", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const changePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Passwords do not match." });
    }

    const user = req.session.userData;

    if (!user || !user.email) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: "User session expired. Please log in again.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const passwordChange = await userSchema.updateOne(
      { email: user.email },
      { $set: { password: hashedPassword } }
    );

    if (passwordChange.modifiedCount > 0) {
      req.session.save(() => {
        console.log("Session saved.");
        res.status(httpStatus.OK).json({
          success: true,
          message: "Password changed successfully.",
          redirectUrl: "/login",
        });
        console.log("Password changed successfully.");
      });
    } else {
      console.log(
        "Password not updated. It might be the same as the current one."
      );
      res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "Password not updated. Try a new password.",
      });
    }
  } catch (error) {
    console.error("Error in changing the password:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const resendPswrdOtp = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    const { email } = req.session.userData;

    if (!email) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 5 * 60 * 1000;

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log("Resend Otp:", otp);
      // req.session.touch(); // Refresh session
      res
        .status(httpStatus.OK)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error resending OTP", error.message);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error. Please try later.",
    });
  }
};

const productDetails = async (req, res) => {
  try {
    const productId = req.query.id;
    let isOutOfStock = false;
    const productDoc = await Product.findById(productId)
      .populate("category", "name")
      .lean();

    if (!productDoc) {
      return res
        .status(httpStatus.NOT_FOUND)
        .render("user/page-404", { title: "Product Not Found" });
    }

    const product = {
      ...productDoc,
      allVariants: productDoc.variants,
      firstImage:
        productDoc.productImages && productDoc.productImages.length > 0
          ? productDoc.productImages[0]
          : "default.jpg",
    };

    const isBeauty = product.category.name;

    if (isBeauty === "Beauty") {
      if (!product.quantity || product.quantity === 0) {
        isOutOfStock = true;
      }
    } else {
      if (!product.size || product.size.length === 0) {
        isOutOfStock = true;
      }
    }

    const categories = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      brand: { $in: brand.map((brand) => brand._id) },
      size: { $ne: [] },
    });

    productData = productData.sort(() => 0.5 - Math.random()).slice(0, 12);

    productData = productData.slice().map((product) => {
      return {
        ...product._doc,
        firstImage:
          product.productImages && product.productImages.length > 0
            ? product.productImages[0]
            : "default.jpg",
      };
    });

    res.render("user/product-details", {
      title: "Product details",
      adminHeader: true,
      hideFooter: false,
      product,
      products: productData,
      isOutOfStock,
      isBeauty,
    });
  } catch (error) {
    console.error("Error in rendering home page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const mensCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const categories = await Category.find({
      isListed: true,
      isDeleted: false,
      name: { $regex: "Mens" },
    });
    const brand = await Brand.find({ isBlocked: false });

    const categoryIds = categories.map((cat) => cat._id);
    const brandIds = brand.map((brand) => brand._id);

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      isDeleted: false,
      isActive: true,
      category: { $in: categoryIds },
      brand: { $in: brandIds },
      size: { $ne: [] },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    let productData = await Product.find({
      isDeleted: false,
      isBlocked: false,
      isActive: true,
      category: { $in: categoryIds },
      brand: { $in: brandIds },
      size: { $ne: [] },
    })
      .skip(skip)
      .limit(limit);

    productData = productData.map((product) => {
      return {
        ...product._doc,
        firstImage:
          product.productImages && product.productImages.length > 0
            ? product.productImages[0]
            : "default.jpg",
      };
    });

    res.render("user/mens", {
      title: "Mens Category",
      adminHeader: true,
      hideFooter: true,
      products: productData,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error("Error in rendering mens category:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const womensCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const categories = await Category.find({
      isListed: true,
      isDeleted: false,
      name: { $regex: "Womens", $options: "i" },
    });

    const brand = await Brand.find({ isBlocked: false });
    const brandIds = brand.map((brand) => brand._id);
    const categoryIds = categories.map((cat) => cat._id);

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      isDeleted: false,
      isActive: true,
      category: { $in: categoryIds },
      brand: { $in: brandIds },
      size: { $ne: [] },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    let productData = await Product.find({
      isBlocked: false,
      isDeleted: false,
      isActive: true,
      category: { $in: categoryIds },
      brand: { $in: brandIds },
      size: { $ne: [] },
    })
      .skip(skip)
      .limit(limit);

    productData = productData.map((product) => {
      return {
        ...product._doc,
        firstImage:
          product.productImages && product.productImages.length > 0
            ? product.productImages[0]
            : "default.jpg",
      };
    });

    res.render("user/womens", {
      title: "Mens Category",
      adminHeader: true,
      hideFooter: true,
      products: productData,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error("Error in rendering mens category:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const beautyCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const categories = await Category.find({
      isListed: true,
      isDeleted: false,
      name: { $regex: "Beauty", $options: "i" },
    });
    const brand = await Brand.find({ isBlocked: false });
    const brandIds = brand.map((brand) => brand._id);

    const categoryIds = categories.map((cat) => cat._id);

    const totalProducts = await Product.countDocuments({
      isDeleted: false,
      isBlocked: false,
      isActive: true,
      category: { $in: categoryIds },
      brand: { $in: brandIds },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    let productData = await Product.find({
      isBlocked: false,
      isDeleted: false,
      isActive: true,
      category: { $in: categoryIds },
    })
      .skip(skip)
      .limit(limit);

    productData = productData.map((product) => {
      return {
        ...product._doc,
        firstImage:
          product.productImages && product.productImages.length > 0
            ? product.productImages[0]
            : "default.jpg",
      };
    });

    res.render("user/beauty", {
      title: "Mens Category",
      adminHeader: true,
      hideFooter: true,
      products: productData,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error("Error in rendering mens category:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

//user inof management

const loadmyAccount = async (req, res) => {
  try {
    const userId = req.session.user || req.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await userSchema.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

    res.render("user/profileInfo", {
      title: "Profile Information",
      adminHeader: true,
      name: user.name,
      email: user.email,
      gender: user.gender,
      phone: user.phone,
      user,
      userId: user._id,
    });
  } catch (error) {
    console.error("Error in rendering My account:", error);
    res.redirect("/pageNotFound");
  }
};

const editProfileInfo = async (req, res) => {
  try {
    const id = req.params.id;
    const name = req.body.name?.trim();
    const phone = req.body.phone?.trim();
    const email = req.body.email?.trim();
    const gender = req.body.gender?.trim();

    if (!name || !phone || !email || !gender) {
      return res
        .status(httpStatus.OK)
        .json({ message: MESSAGES.MISSING_FIELDS || "Missing fields" });
    }

    const data = await userSchema.find({
      $or: [{ name }, { phone }, { email }],
      _id: { $ne: id },
    });
    const isMatched = await userSchema.findById(id);

    if (data.length > 0) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: MESSAGES.ALREADY_EXISTS || "Email or phone already exists",
      });
    }

    // Check if the new values are different from current values
    if (
      isMatched.name === name &&
      isMatched.phone === phone &&
      isMatched.email === email &&
      isMatched.gender === gender
    ) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message:
          MESSAGES.USERINFO.EDIT_WITH_NEW_VALUE || "Edit with new values",
      });
    }

    await userSchema.findByIdAndUpdate(
      id,
      { $set: { name, email, phone, gender } },
      { new: true }
    );

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.USERINFO.EDIT_SUCCESS || "Updated" });
  } catch (error) {
    console.error("Error in rendering product info:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

//change password management
const loadChangePassword = async (req, res) => {
  try {
    const errorMessage = req.query.error;
    const userId = req.session.user;
    const user = await userSchema.findById(userId);

    res.render("user/changePassword", {
      title: "Change password",
      adminHeader: true,
      errorMessage,
      name: user.name,
    });
  } catch (error) {
    console.error("Error in Change password rendering:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const handleChangePassword = async (req, res) => {
  try {
    const userId = req.session.user;

    const { currentPassword, newPassword, confirmPassword } = req.body;

    //validating values

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: MESSAGES.MISSING_FIELDS || "Fill all the fields" });
    }
    if (confirmPassword !== newPassword) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message:
          MESSAGES.CHANGE_PASSWORD.MISMATCH ||
          "New password and confirm password do not match",
      });
    }

    const user = await userSchema.findById(userId).select("+password");

    if (!user || !user.password) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message:
          MESSAGES.USER_NOT_FOUND || "User not found or password missing",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    const isSame = await bcrypt.compare(newPassword, user.password);

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    if (!isMatch) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message:
          MESSAGES.CHANGE_PASSWORD.INVALID_CURRENT_PASSWORD ||
          "current password mismatch",
      });
    }
    if (isSame) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message:
          MESSAGES.CHANGE_PASSWORD.SAME_PASSWORD ||
          "new password and current password are same ",
      });
    }

    await userSchema.findByIdAndUpdate(userId, { password: hashedPassword });

    return res.status(httpStatus.OK).json({
      message: MESSAGES.CHANGE_PASSWORD.SUCCESS || "Password changed",
    });
  } catch (error) {
    console.error("Error in Changing password :", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.INTERNAL_SERVER_ERROR || "Server error" });
  }
};

const renderForgotPasswordPage = async (req, res) => {
  try {
    return res.render("user/changePswrd-forgotPasswordEmail", {
      title: "Forgot password",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
      messages: req.flash("error"),
    });
  } catch (error) {
    console.error("Error in rendering login page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const handleForgotPasswordOtpRequest = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.session.user;

    if (!email) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: MESSAGES.CHANGE_PASSWORD.EMAIL_REQUIRED || "Email is required",
      });
    }

    const user = await userSchema.findById(userId);
    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User not found" });
    }

    if (user.email !== email) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message:
          MESSAGES.CHANGE_PASSWORD.INVALID_EMAIL ||
          "Invalid email for the current user",
      });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: "Failed to send email. Please try again." });
    }

    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
    req.session.userData = { email };

    console.log("OTP sent:", otp);

    return res.status(httpStatus.OK).json({
      message: "OTP sent successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error in handleForgotPasswordOtpRequest:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.INTERNAL_SERVER_ERROR || "Server error" });
  }
};

const renderVerifyOtpPage = async (req, res) => {
  try {
    res.render("user/changePasswored-verifyOTP", {
      title: "Trenaura Verify OTP",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in forgotPasswordOtp:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const changePasswordVerifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;
    const otpExpiresAt = req.session.otpExpiresAt;

    if (!sessionOtp || !otpExpiresAt) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "OTP session expired or invalid." });
    }

    if (Date.now() > otpExpiresAt) {
      delete req.session.userOtp;
      delete req.session.otpExpiresAt;
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    if (String(otp) === String(sessionOtp)) {
      req.session.userData = { email: req.session.userData.email };

      return res
        .status(httpStatus.OK)
        .json({ success: true, redirectUrl: "/renderChange-password" });
    } else {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error in forgotPasswordOtp:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const renderChangePassword = async (req, res) => {
  try {
    return res.render("user/changePassword-forgotPassword-page", {
      title: "Forgot password",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in verfyOtp :", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const submitChangedPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const userId = req.session.user;

    if (password !== confirmPassword) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Passwords do not match." });
    }

    const user = req.session.userData;

    if (!user || !user.email) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: "User session expired. Please log in again.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const passwordChange = await userSchema.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );

    if (passwordChange.modifiedCount > 0) {
      req.session.save(() => {
        console.log("Session saved.");
        res.status(httpStatus.OK).json({
          success: true,
          message: "Password changed successfully.",
          redirectUrl: "/login",
        });
        console.log("Password changed successfully.");
      });
    } else {
      console.log(
        "Password not updated. It might be the same as the current one."
      );
      res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "Password not updated. Try a new password.",
      });
    }
  } catch (error) {
    console.error("Error in changing the password:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

module.exports = {
  loadTrenauraHomepage,
  loadHomepage,
  pageNotFound,
  loadLogin,
  login,
  loadSignup,
  signup,
  verifyOtp,
  verifySignupOtp,
  resendSignupOtp,
  loadmyAccount,
  loadLogout,
  logout,
  forgotPassword,
  forgotPasswordOtp,
  verifyForgotPasswordOtp,
  loadForgotPassword,
  changePassword,
  resendPswrdOtp,
  productDetails,
  loadShop,
  mensCategory,
  womensCategory,
  beautyCategory,
  editProfileInfo,
  loadChangePassword,
  handleChangePassword,
  renderForgotPasswordPage,
  handleForgotPasswordOtpRequest,
  changePasswordVerifyOTP,
  renderChangePassword,
  submitChangedPassword,
  renderVerifyOtpPage,
};
