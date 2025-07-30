const userSchema = require("../models/userSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const Address = require("../models/addressSchema");

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
    });

    // Get latest 4 products
    productData = productData.slice(0, 4).map((product) => {
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
      hideFooter: true,
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
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    let productData = await Product.find({
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
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    let productData = await Product.find({
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

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await userSchema.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

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
    console.log("Edit address rwached");
    const addressId = req.params.id;
    const userId = req.session.user || req.user;
    console.log(`userid:${userId}`);
    console.log(`addressid:${addressId}`);
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
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({
          message:
            MESSAGES.CHANGE_PASSWORD.MISMATCH ||
            "New password and confirm password do not match",
        });
    }

    const user = await userSchema.findById(userId).select("+password");

    if (!user) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: MESSAGES.USER_NOT_FOUND || "User not found" });
    }
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
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({
          message:
            MESSAGES.CHANGE_PASSWORD.INVALID_CURRENT_PASSWORD ||
            "current password mismatch",
        });
    }
    if (isSame) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({
          message:
            MESSAGES.CHANGE_PASSWORD.SAME_PASSWORD ||
            "new password and current password are same ",
        });
    }

    await userSchema.findByIdAndUpdate(userId, { password: hashedPassword });

    return res
      .status(httpStatus.OK)
      .json({
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

    const user = await userSchema.findById(userId);

    if (user.email !== email) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "Invalid mail id for the user" });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: "Failed to send email" });
    }

    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
    req.session.userData = { email };

    console.log("OTP sent:", otp);
    if (req.session.userOtp) {
      return res
        .status(httpStatus.OK)
        .json({ message: "Otp sent Successfully" });
    }
  } catch (error) {
    console.error("Error in forgotPasswordOtp:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
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
};
