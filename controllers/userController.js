const userSchema = require("../models/userSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const Address = require("../models/addressSchema");
const Cart = require("../models/cartSchema");
const Wishlist = require("../models/wishlistSchema");
const Order = require("../models/orderSchema");

const bcrypt = require("bcrypt");
const saltRounds = 10;
const nodeMailer = require("nodemailer");
const { isLoggedIn } = require("../middleware/userAuth");
const env = require("dotenv").config();
const httpStatus = require("../util/statusCodes");
const { MESSAGES } = require("../util/constants");
const { default: mongoose } = require("mongoose");

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

const signup = async (req, res) => {
  try {
    let { name, email, phone, password } = req.body;

    const existingEmail = await userSchema.findOne({ email });
    const existingPhone = await userSchema.findOne({ phone });
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
    req.session.userData = { name, email, phone, password };
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
      const user = req.session.userData;
      const hashedPassword = await bcrypt.hash(user.password, saltRounds);

      const saveUserData = new userSchema({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: hashedPassword,
      });

      await saveUserData.save();

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
      category: { $in: categories.map((category) => category._id) },
      quantity: { $gt: 0 },
    }).sort({
      createdOn: -1,
    });

    // Get latest 4 products
    productData = productData.slice(0, 8).map((product) => {
      return {
        ...product._doc,
        firstImage:
          product.productImages && product.productImages.length > 0
            ? product.productImages[0]
            : "default.jpg",
      };
    });

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
    const products = await Product.find({
      isBlocked: false,
      isDeleted: false,
      quantity: { $gt: 0 },
    }).lean();

    return res.render("user/shop", {
      title: "Trenaura - Shop page",
      isLoggedIn: !!user,
      adminHeader: true,
      products,
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
    const productDoc = await Product.findById(productId).lean();

    if (!productDoc) {
      return res
        .status(httpStatus.NOT_FOUND)
        .render("user/page-404", { title: "Product Not Found" });
    }

    const product = {
      ...productDoc,
      firstImage:
        productDoc.productImages && productDoc.productImages.length > 0
          ? productDoc.productImages[0]
          : "default.jpg",
    };

    const categories = await Category.find({ isListed: true });

    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      quantity: { $gt: 0 },
    });

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
    const limit = 2;
    const skip = (page - 1) * limit;

    const categories = await Category.find({
      isListed: true,
      name: { $regex: "Mens" },
    });

    const categoryIds = categories.map((cat) => cat._id);

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    let productData = await Product.find({
      isDeleted: false,
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
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
    const limit = 2;
    const skip = (page - 1) * limit;

    const categories = await Category.find({
      isListed: true,
      name: { $regex: "Womens", $options: "i" },
    });

    const categoryIds = categories.map((cat) => cat._id);

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    let productData = await Product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
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
    const limit = 2;
    const skip = (page - 1) * limit;

    const categories = await Category.find({
      isListed: true,
      name: { $regex: "Beauty", $options: "i" },
    });

    const categoryIds = categories.map((cat) => cat._id);

    const totalProducts = await Product.countDocuments({
      isDeleted: false,
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    let productData = await Product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
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

const filter = async (req, res) => {
  try {
    const { category, price, page = 1, limit = 2 } = req.query;
    const skip = (page - 1) * limit;
    let filter = {};

    if (category) {
      filter.category = category;
    }

    if (price) {
      let priceRange = price.split("-");
      if (priceRange.length === 2) {
        filter.salePrice = {
          $gte: parseInt(priceRange[0]),
          $lte: parseInt(priceRange[1]),
        };
      } else if (priceRange[0] === "8000+") {
        filter.salePrice = { $gte: 8000 };
      }
    }

    const totalProducts = await Product.countDocuments(filter);

    const totalPages = Math.ceil(totalProducts / limit);

    let products = await Product.find(filter).skip(skip).limit(limit);

    products = products.map((product) => {
      return {
        ...product._doc,
        firstImage:
          product.productImages && product.productImages.length > 0
            ? product.productImages[0]
            : "default.jpg",
        productName: product.productName,
        salePrice: product.salePrice,
        regularPrice: product.regularPrice,
        description: product.description,
      };
    });

    res.render("user/mens", {
      title: "Mens Category",
      adminHeader: true,
      hideFooter: true,
      products,
      currentPage: parseInt(page),
      totalPages,
      category,
      price,
    });
  } catch (error) {
    console.error(error);
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

//address management
const loadmyAddress = async (req, res) => {
  try {
    const userId = req.session.user || req.user;

    const user = await userSchema.findById(userId);

    const userAddresses = await Address.findOne({ userId });

    const addresses = userAddresses ? userAddresses.address : [];
    // Converting Mongoose documents to plain objects
    const plainAddresses = addresses.map((address) =>
      address.toObject ? address.toObject() : address
    );
    res.render("user/addressManage", {
      title: "Address management",
      adminHeader: true,
      name: user.name,
      user,
      addresses: plainAddresses,
      userId: user._id,
    });
  } catch (error) {
    console.error("Error in rendering address management:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const {
      addressType,
      name,
      locality,
      address,
      cityOrTown,
      state: selectedState,
      pincode,
      phone,
      altPhone,
      landmark,
    } = req.body;

    if (
      !name ||
      !phone ||
      !pincode ||
      !address ||
      !selectedState ||
      !addressType ||
      !locality ||
      !cityOrTown
    ) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: MESSAGES.ADD_ADDRESS.MISSING_FIELDS });
    }

    const newAddress = {
      addressType,
      name,
      locality,
      address,
      city: cityOrTown,
      landMark: landmark,
      state: selectedState,
      pincode: Number(pincode),
      phone: Number(phone),
      altPhone: altPhone ? Number(altPhone) : undefined,
    };

    const userAddress = await Address.findOne({ userId });

    if (userAddress) {
      userAddress.address.push(newAddress);
      await userAddress.save();
    } else {
      await Address.create({ userId, address: [newAddress] });
    }

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.ADD_ADDRESS.SUCCESS || "Address added" });
  } catch (error) {
    console.error("Error in rendering product info:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const loadEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user || req.user;

    const userAddresses = await Address.findOne({ userId });

    if (!userAddresses) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: "No addresses found",
      });
    }

    const address = userAddresses.address.find(
      (addr) => addr._id.toString() === addressId
    );

    if (!address) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: "Address not found",
      });
    }

    res.status(httpStatus.OK).json(address);
  } catch (error) {
    console.error("Error in loading edit address:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user || req.user;

    const {
      addressType,
      name,
      locality,
      address,
      city,
      state,
      pincode,
      phone,
      altPhone,
      landMark,
    } = req.body;

    // Validation
    if (
      !name ||
      !phone ||
      !pincode ||
      !address ||
      !state ||
      !addressType ||
      !locality ||
      !city
    ) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: "Please fill all required fields",
      });
    }

    // Find the user's address document
    const userAddresses = await Address.findOne({ userId });

    if (!userAddresses) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: "No addresses found",
      });
    }

    const isAddress = await Address.findOne({ "address._id": addressId });
    const result = isAddress.address.find(
      (addr) => addr._id.toString() === addressId
    );
    // Find and update the specific address
    const addressIndex = userAddresses.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: "Address not found",
      });
    }

    // Update the address
    userAddresses.address[addressIndex] = {
      ...userAddresses.address[addressIndex],
      addressType,
      name,
      locality,
      address,
      city,
      landMark,
      state,
      pincode: Number(pincode),
      phone: Number(phone),
      altPhone: altPhone ? Number(altPhone) : null,
    };

    await userAddresses.save();

    return res.status(httpStatus.OK).json({
      message: MESSAGES.EDIT_ADDRESS.SUCCESS || "Edited Successfully",
    });
  } catch (error) {
    console.error("Error in updating address:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const deleteAddress = async (req, res) => {
  try {
    const id = req.params.id;
    await Address.updateOne(
      { "address._id": id },
      { $pull: { address: { _id: id } } }
    );
    res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.EDIT_ADDRESS.DELETE_ADDRESS || "Deleted" });
  } catch (error) {
    console.error("Error in deleting address:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

//change password management
const loadChangePassword = async (req, res) => {
  try {
    const errorMessage = req.query.error;

    res.render("user/changePassword", {
      title: "Change password",
      adminHeader: true,
      errorMessage,
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

// cart management

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.id;
    const { size = "S" } = req.body || "S";
    const quantity = 1;

    const product = await Product.findById(productId);

    if (!product || product.isDeleted || product.isBlocked) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Product not available" });
    }

    const price = product.salePrice;
    const totalPrice = price * quantity;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({
        userId,
        items: [
          {
            productId,
            quantity,
            price,
            totalPrice,
            size,
          },
        ],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
        cart.items[itemIndex].totalPrice =
          cart.items[itemIndex].quantity * price;
      } else {
        cart.items.push({ productId, quantity, price, totalPrice, size });
      }
    }

    await cart.save();
    const cartCount = await Cart.findOne({ userId }).lean();
    const cartLength = cartCount?.items?.length || 0;

    return res
      .status(httpStatus.OK)
      .json({ message: "Added to cart", cartCount: cartLength });
  } catch (error) {
    console.error("Error in addToCart:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const loadmyCart = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const products = await Product.find().limit(8).lean();

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        match: { isBlocked: false, isDeleted: false },
      })
      .lean();
    let totalPrice = 0;
    //sorting items with a valid productId .
    if (cart?.items?.length) {
      cart.items = cart.items.filter((item) => item.productId !== null);

      //total price of the cart items
      totalPrice = cart.items.reduce((total, item) => {
        return total + item.totalPrice;
      }, 0);
    }

    //if cart is empty
    if (!cart || cart.items.length === 0) {
      return res.render("user/shopping-cart", {
        title: "Shopping Bag",
        adminHeader: true,
        hideFooter: false,
        isCartEmpty: true,
        cartItems: [],
        products,
      });
    }

    return res.render("user/shopping-cart", {
      title: "Shopping Bag",
      adminHeader: true,
      hideFooter: false,
      cartItems: cart.items,
      isCartEmpty: cart.items.length === 0,
      products,
      totalPrice,
    });
  } catch (error) {
    console.error("Error in loadmyCart:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

// const increaseQuantity = async (req, res) => {
//   try {
//     const itemId = req.params.id;
//     const userId = req.session.user;

//     const result = await Cart.updateOne(
//       { userId, "items._id": itemId },
//       {
//         $inc: {
//           "items.$.quantity": 1,
//         },
//       }
//     );

//     const cart = await Cart.findOne({ userId })
//       .populate({
//         path: "items.productId",
//         match: { isBlocked: false, isDeleted: false },
//       })
//       .lean();

//     if (cart?.items?.length) {
//       cart.items = cart.items.filter((item) => item.productId !== null);
//     }

//     const item = cart.items.find((i) => i._id.toString() === itemId);

//     const totalPrizeOfProduct = item.quantity * item.price;

//     await Cart.updateOne(
//       { userId, "items._id": itemId },
//       {
//         $set: {
//           "items.$.totalPrice": totalPrizeOfProduct,
//         },
//       }
//     );

//     return res
//       .status(httpStatus.OK)
//       .json({ message: MESSAGES.CART.QUANTITY_INCREASE || "Increased by One" });
//   } catch (error) {
//     console.error("Error in increasing the quantity:", error);
//     res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
//       success: false,
//       message: "An error occurred. Please try again later.",
//     });
//   }
// };

// const decreaseQuantity = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const itemId = req.params.id;

//     await Cart.updateOne(
//       { userId, "items._id": itemId },
//       {
//         $inc: { "items.$.quantity": -1 },
//       }
//     );

//     const cart = await Cart.findOne({ userId })
//       .populate({
//         path: "items.productId",
//         match: { isBlocked: false, isDeleted: false },
//       })
//       .lean();

//     if (cart?.items?.length) {
//       cart.items = cart.items.filter((item) => item.productId !== null);
//     }

//     const item = cart.items.find((i) => i._id.toString() === itemId);

//     const totalPrizeOfProduct = item.quantity * item.price;

//     await Cart.updateOne(
//       { userId, "items._id": itemId },
//       {
//         $set: { "items.$.totalPrice": totalPrizeOfProduct },
//       }
//     );

//     return res.status(httpStatus.OK).json({
//       message: MESSAGES.CART.QUANTITY_DECREASE || "Quantity decreased",
//     });
//   } catch (error) {
//     console.error("Error in decreasing the quantity:", error);
//     res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
//       success: false,
//       message: "An error occurred. Please try again later.",
//     });
//   }
// };

const increaseQuantity = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.session.user;
    const {quantity}=req.body

    const cart = await Cart.findOne(
      { userId, "items._id": itemId },
      { "items.$": 1 }
    )
      .populate("items.productId", "quantity")
      .lean();

    if (!cart || !cart.items.length) {
      return res.status(404).json({ message: "Item not found" });
    }

    const item = cart.items[0];
    const stock = item.productId.quantity;
    console.log( `stock for the product ${ item.productId._Id} is ${stock}`)

    if(quantity>=stock){
      return res.status(httpStatus.BAD_REQUEST).json({message:"Quantity should be less than the total stock of the product"})
    }
    

    // Increase quantity
    await Cart.updateOne(
      { userId, "items._id": itemId },
      { $inc: { "items.$.quantity": 1 } }
    );

    const updatedCart = await Cart.findOne({ userId })
      .populate("items.productId")
      .lean();

    const updatedItem = updatedCart.items.find(
      (item) => item._id.toString() === itemId
    );
    const totalPrice = updatedItem.quantity * updatedItem.price;
    const grandTotal = updatedCart.items.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);
    //updating with new values
    await Cart.updateOne(
      { userId, "items._id": itemId },
      { $set: { "items.$.totalPrice": totalPrice } }
    );

    return res.status(httpStatus.OK).json({
      message: MESSAGES.CART.QUANTITY_INCREASE || "Increased by One",
      quantity: updatedItem.quantity,
      totalPrice,
      grandTotal,
    });
  } catch (error) {
    console.error("Error in increasing the quantity:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const decreaseQuantity = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.session.user;

    // Fetch current item first
    const cart = await Cart.findOne(
      { userId, "items._id": itemId },
      { "items.$": 1 }
    ).lean();

    if (!cart || !cart.items.length) {
      return res.status(404).json({ message: "Item not found" });
    }

    const item = cart.items[0];

    if (item.quantity <= 1) {
      return res.status(400).json({ message: "Minimum quantity is 1" });
    }
    // Decrease quantity
    await Cart.updateOne(
      { userId, "items._id": itemId },
      { $inc: { "items.$.quantity": -1 } }
    );

    const updatedCart = await Cart.findOne({ userId })
      .populate("items.productId")
      .lean();

    const updatedItem = updatedCart.items.find(
      (item) => item._id.toString() === itemId
    );

    const totalPrice = updatedItem.quantity * updatedItem.price;
    const grandTotal = updatedCart.items.reduce((total, item) => {
      return total + item.quantity * item.price;
    }, 0);

    //updating with new values
    await Cart.updateOne(
      { userId, "items._id": itemId },
      { $set: { "items.$.totalPrice": totalPrice } }
    );

    return res.status(httpStatus.OK).json({
      message: MESSAGES.CART.QUANTITY_DECREASE || "Quantity decreased",
      quantity: updatedItem.quantity,
      totalPrice,
      grandTotal,
    });
  } catch (error) {
    console.error("Error in decreasing the quantity:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const removefromCart = async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.session.user;

    await Cart.updateOne({ userId }, { $pull: { items: { _id: itemId } } });

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.CART.ITEM_DELETED || "item deleted" });
  } catch (error) {
    console.error("Error in removing item from cart:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

//wishlist mangement

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: "products.productsId",
        match: { isBlocked: false, isDeleted: false },
      })
      .lean();
    //sorting items with a valid productId .
    if (wishlist?.products?.length) {
      wishlist.products = wishlist.products.filter(
        (product) => product.productsId !== null
      );
    }

    if (!wishlist || wishlist.products.length === 0) {
      return res.render("user/wishlist", {
        title: "Wishlist",
        adminHeader: true,
        isWishListEmpty: true,
        wishlistItems: [],
      });
    }

    return res.render("user/wishlist", {
      title: "Wishlist",
      adminHeader: true,
      wishlistItems: wishlist.products,
    });
  } catch (error) {
    console.error("Error in rendering wishlist:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const addWishlist = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user;

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId,
        products: [{ productsId: productId }],
      });
    } else {
      let productIndex = wishlist.products.findIndex(
        (product) => product.productsId.toString() === productId
      );

      if (productIndex === -1) {
        wishlist.products.push({ productsId: productId });
      }
    }
    await wishlist.save();

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.WISHLIST.WISHLISTED });
  } catch (error) {
    console.error("Error in adding wishlist:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.id;

    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productsId: productId } } }
    );

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.WISHLIST.ITEM_DELETED || "Deleted" });
  } catch (error) {
    console.error("Error in deleting wishlist item:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

//order management

const loadMyOrder = async (req, res) => {
  try {
    const userId = req.session.user;

    const myOrders = await Order.find({ userId })
      .populate({
        path: "orderedItems.productId",
        match: { isBlocked: false, isDeleted: false },
      })
      .sort({ createdAt: -1 })
      .lean();

    // Filter out null products from each order

    const filteredOrders = myOrders
      .map((order) => {
        order.orderedItems = order.orderedItems.filter(
          (item) => item.productId !== null
        );
        order.foramttedDate = new Date(order.createdAt).toLocaleDateString();
        order.statusHistory =
          order.statusHistory[order.statusHistory.length - 1].status;
        return order;
      })
      .filter((order) => order.orderedItems.length > 0);

    if (filteredOrders.length === 0) {
      return res.render("user/myOrder", {
        title: "My order",
        adminHeader: true,
        isMyOrderEmpty: true,
        myOrder: [],
      });
    }

    return res.render("user/myOrder", {
      title: "My order",
      adminHeader: true,
      myOrder: filteredOrders,
    });
  } catch (error) {
    console.error("Error in loadMyOrder:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const loadAddressForOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.id;
    const { size, quantity } = req.query;
    console.log(`loadAddressForOrder Your product id is  ${productId}`);
    console.log(`loadAddressForOrder Your size  ${size}`);
    console.log(`loadAddressForOrder Your quantity ${quantity}`);

    const user = await userSchema.findById(userId);
    const userAddresses = await Address.findOne({ userId });

    const addresses = userAddresses ? userAddresses.address : [];

    // Converting Mongoose documents to plain objects
    const plainAddresses = addresses.map((address) =>
      address.toObject ? address.toObject() : address
    );

    return res.render("user/orderAddress", {
      title: "select address",
      adminHeader: true,
      addresses: plainAddresses,
      productId,
      size,
      quantity,
    });
  } catch (error) {
    console.error("Error in loading address for order:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const submitAddress = async (req, res) => {
  try {
    const addressId = req.body.selectedAddress;
    userId = req.session.user;
    const { productId, size } = req.body;

    console.log(`submitAddress Your product id is ${productId}`);

    //submitting address
    await Address.updateOne(
      { userId },
      { $set: { "address.$[].selected": false } }
    );

    const result = await Address.updateOne(
      { userId, "address._id": addressId },
      { $set: { "address.$.selected": true } }
    );
    const product = await Product.findById(productId);

    let quantity = 1;
    const price = product.salePrice;
    const totalPrice = price * quantity;

    //saving item to cart

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({
        userId,
        items: [
          {
            productId,
            quantity,
            price,
            totalPrice,
            size,
          },
        ],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
        cart.items[itemIndex].totalPrice =
          cart.items[itemIndex].quantity * price;
      } else {
        cart.items.push({ productId, quantity, price, totalPrice, size });
      }
    }
    //saving cart
    await cart.save();

    //getting cart items
    const updatedCart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        match: { isBlocked: false, isDeleted: false },
      })
      .lean();

    //fetching the current item
    const currentItem = updatedCart.items.find(
      (item) => item.productId && item.productId._id.toString() === productId
    );

    console.log(`submit address reached`);

    //add to cart then
    return res.render("user/orderSummary", {
      title: "Order Summary",
      adminHeader: true,
      hideFooter: false,
      cartItems: currentItem ? [currentItem] : [],
      totalPrice: currentItem ? currentItem.totalPrice : 0,
    });
  } catch (error) {
    console.error(
      "Error in selecting address and saving to cart for order:",
      error
    );
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const loadPaymentMethod = async (req, res) => {
  try {
    const userId = req.session.user;
    const { itemId } = req.query;

    //for all the cart items
    if (!itemId) {
      const cart = await Cart.findOne({ userId })
        .populate("items.productId", "productName productImages salePrice")
        .lean();

      //cheking ifthe cart is empty
      if (!cart || !cart.items || cart.items.length === 0) {
        console.error("Cart is empty for user:", userId);
        return res.status(400).send("Cart is empty");
      }

      const grandTotal = cart.items.reduce((total, item) => {
        return total + item.totalPrice;
      }, 0);

      return res.render("user/paymentMethod", {
        title: "Payment method",
        adminHeader: true,
        grandTotal,
      });
    }

    const cart = await Cart.findOne(
      { userId, "items._id": itemId },
      { "items.$": 1 }
    ).populate("items.productId");

    const item = cart.items[0];
    const grandTotal = item.totalPrice;

    console.log(`loadPaymentMethod item id is ${itemId}`);
    console.log("loadPaymentMethod reached");

    return res.render("user/paymentMethod", {
      title: "Payment method",
      adminHeader: true,
      itemId,
      grandTotal,
    });
  } catch (error) {
    console.error("Error in rendering payment method for order:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const orderSuccess = async (req, res) => {
  try {
    console.log("orderSuccess reached");
    const userId = req.session.user;
    let { itemId, paymentMethod } = req.body;

    //getting address
    const userAddress = await Address.findOne({ userId });
    //cheking address
    if (
      !userAddress ||
      !userAddress.address ||
      userAddress.address.length === 0
    ) {
      console.error("No address found for user:", userId);
      return res.status(httpStatus.BAD_REQUEST).json({message:"No address found, please add address"})
    }
    const selectedAddress = userAddress.address.find(
      (a) => a.selected === true
    );

    //getting cart items
    const cart = await Cart.findOne({ userId })
      .populate("items.productId", "productName productImages salePrice")
      .lean();

    if (!cart || cart.items.length === 0) {
      console.error("Cart not found for user:", userId, " itemId:", itemId);
    }

    //checking payment methods
    let paymentStatus;
    if (paymentMethod === "cod") {
      paymentStatus = "Unpaid";
    } else if (paymentMethod === "Razorpay" || paymentMethod === "PayPal") {
      paymentStatus = "Paid";
    } else {
      return res.status(400).send("Invalid payment method");
    }

    let newOrder;
    let isWholeCart;
    let item;

    if (itemId) {
      item = cart.items.find((i) => i._id.toString() === itemId);
      if (!item) {
        console.error("Item not found in cart:", itemId);
        return res.status(404).send("Item not found in cart");
      }

      newOrder = new Order({
        userId: userId,
        orderedItems: [
          {
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.price,
          },
        ],
        totalPrice: item.totalPrice,
        finalAmount: item.totalPrice,
        address: selectedAddress._id,
        paymentMethod: "COD",
        paymentStatus: "Unpaid",
        statusHistory: [
          {
            status: "Pending",
          },
        ],
      });
      await newOrder.save();

      //increasing quantity
      const productId = item.productId._id;
      const quantity = item.quantity;
      await Product.updateOne(
        { _id: productId },
        { $inc: { quantity: -quantity } }
      );

      isWholeCart = false;
    }
    //order for the whole cart
    else {
      const orderedItems = cart.items.map((item) => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.price,
        totalPrice:item.totalPrice
      }));

      //saving order for each item in the cart
      for (const item of orderedItems) {
        const totalPrice = item.totalPrice;
        const discount = 0;
        const finalAmount = totalPrice - discount;

        newOrder = new Order({
          userId,
          orderedItems: [item],
          totalPrice,
          discount,
          finalAmount,
          address: selectedAddress._id,
          statusHistory: [
            {
              status: "Pending",
            },
          ],
          paymentMethod: "COD",
          paymentStatus: "Unpaid",
        });
        const isSaved = await newOrder.save();
        //increasing quantity
        const productId = item.productId._id;
        const quantity = item.quantity;
        await Product.updateOne(
          { _id: productId },
          { $inc: { quantity: -quantity } }
        );
      }

      isWholeCart = true;
    }

    return res.redirect(
      isWholeCart
        ? `/order-placed?isWholeCart=${isWholeCart}`
        : `/order-placed?itemId=${itemId}&isWholeCart=${isWholeCart}`
    );

    // return res.status(httpStatus.OK).json({ message: itemId });
  } catch (error) {
    console.error("Error in rendering orderSuccess :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const orderPlaced = async (req, res) => {
  try {
    const userId = req.session.user;
    const itemId = req.query.itemId;
    const isWholeCart = req.query.isWholeCart === "true";

    if (isWholeCart) {
      //remove item from cart
      await Cart.deleteOne({ userId });
    } else if (itemId) {
      //remove item from cart
      await Cart.updateOne(
        { userId, "items._id": itemId },
        { $pull: { items: { _id: itemId } } }
      );
      // check  cart is empty
      const updatedCart = await Cart.findOne({ userId });
      //if the cart empty deletes all the cart
      if (updatedCart && updatedCart.items.length === 0) {
        await Cart.deleteOne({ userId });
      }
    }

    return res.render("user/orderSuccess", {
      title: "Order placed",
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in rendering orderPlaced :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        $push: { statusHistory: { status, changedAt: new Date() } },
      },
      { new: true }
    );
    const updatedStatus =
      updatedOrder.statusHistory[updatedOrder.statusHistory.length - 1].status;

    const productIds = updatedOrder.orderedItems.map(item =>({
      productId: item.productId,
      quantity: item.quantity,

    }));


      const { productId, quantity } = productIds[0];

      await Product.updateOne(
        { _id: productId },
        { $inc: { quantity: quantity } }
      );


    return res.json({
      success: true,
      message: "Order cancelled",
      status: updatedStatus,
    });
  } catch (error) {
    console.error("Error in cancelOrder :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const orderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    const orders = await Order.findById(orderId)
      .populate("userId", "name")
      .populate(
        "orderedItems.productId",
        "productName productImages description"
      )
      .lean();

    orders.orderedItems = orders.orderedItems.filter((item) => item.productId);
    const updatedDate =
      orders.statusHistory[orders.statusHistory.length - 1].changedAt;
    const date = new Date(updatedDate).toLocaleString();
    const status = orders.statusHistory[orders.statusHistory.length - 1].status;
    const orderedDate = new Date(orders.createdAt).toLocaleDateString();
    const fullStatusHistory = orders.statusHistory.map((history) => ({
      status: history.status,
      changedAt: new Date(history.changedAt).toLocaleString(),
    }));

    console.log(orderId);

    const address = await Address.findOne(
      { "address._id": orders.address },
      { "address.$": 1 }
    ).lean();

    return res.render("user/orderDetails", {
      title: "Order details",
      adminHeader: true,
      orders,
      date,
      address: address.address[0],
      status,
      orderedDate,
      fullStatusHistory,
    });
  } catch (error) {
    console.error("Error in orderDetails :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
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
  filter,
  editProfileInfo,
  loadmyAddress,
  addAddress,
  loadEditAddress,
  editAddress,
  deleteAddress,
  loadChangePassword,
  handleChangePassword,
  renderForgotPasswordPage,
  handleForgotPasswordOtpRequest,
  changePasswordVerifyOTP,
  renderChangePassword,
  submitChangedPassword,
  renderVerifyOtpPage,
  addToCart,
  loadmyCart,
  increaseQuantity,
  decreaseQuantity,
  removefromCart,
  loadWishlist,
  addWishlist,
  removeFromWishlist,
  loadMyOrder,
  loadAddressForOrder,
  submitAddress,
  loadPaymentMethod,
  orderSuccess,
  orderPlaced,
  cancelOrder,
  orderDetails,
};
