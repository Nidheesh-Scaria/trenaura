const userSchema = require("../models/userSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");

const bcrypt = require("bcrypt");
const saltRounds = 10;
const nodeMailer = require("nodemailer");
const { isLoggedIn } = require("../middleware/userAuth");
const env = require("dotenv").config();

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
          encodeURIComponent(
            "Email or phone number already in use. Please use a different one."
          ) +
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
        .status(400)
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
      // Clear sensitive session data
      // delete req.session.userOtp;
      // delete req.session.otpExpiresAt;
      // delete req.session.userData;

      console.log("User registered successfully.");

      // res.redirect("/");
      res.status(200).json({ success: true, redirectUrl: "/" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP, please try again" });
    }
  } catch (error) {
    console.error("Error in verifying the OTP", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

const resendSignupOtp = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    const { email } = req.session.userData;

    if (!email) {
      return res
        .status(400)
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
        .status(200)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error resending OTP", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try later.",
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
    res.status(500).send("Server error");
  }
};

const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user || req.user;

    const categories = await Category.find({ isListed: true });

    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      quantity: { $gt: 0 },
    });

    // Get latest 4 products (optional logic)
    productData = productData.slice(0, 4).map((product) => {
      return {
        ...product._doc,
        firstImage:
          product.productImages && product.productImages.length > 0
            ? product.productImages[0]
            : "default.jpg",
      };
    });

    

    return res.render("user/home", {
      title: "Trenaura - Home page",
      isLoggedIn: !!user,
      adminHeader: true,
      products: productData,
    });
  } catch (error) {
    console.error("Error in rendering home page:", error);
    res.status(500).send("Server error");
  }
};

const loadLogin = async (req, res) => {
  try {
    return res.render("user/login", {
      title: "Trenaura Login page",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
      messages: req.flash("error"),
    });
  } catch (error) {
    console.error("Error in rendering login page:", error);
    res.status(500).send("Server error");
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
    res.status(500).send("Server error");
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
    res.status(500).send("Server error");
  }
};

const loadmyAccount = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    // const userId = req.session.user;
    console.log("Checking login status:", userId);
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await userSchema.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

    console.log("Rendering My Account Page");
    res.render("user/myAccount", {
      title: "My Account",
      name: user.name,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in rendering My account:", error);
    res.redirect("/pageNotFound");
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
    res.status(500).send("Server error");
  }
};

const loadLogout = async (req, res) => {
  try {
    res.redirect("/login");
  } catch (error) {}
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
    res.status(500).send("Server error");
  }
};

const forgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if email exists in DB
    const user = await userSchema.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found with this email" });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to send email" });
    }

    // Store OTP and expiry in session
    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
    req.session.userData = { email };

    console.log("OTP sent:", otp);
    //otp page
    res.render("user/verifyOtpPswd", {
      title: "Trenaura Verify OTP",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in forgotPasswordOtp:", error);
    res.status(500).send("Server error");
  }
};

const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;
    const otpExpiresAt = req.session.otpExpiresAt;

    if (!sessionOtp || !otpExpiresAt) {
      return res
        .status(400)
        .json({ success: false, message: "OTP session expired or invalid." });
    }

    if (Date.now() > otpExpiresAt) {
      delete req.session.userOtp;
      delete req.session.otpExpiresAt;
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    if (String(otp) === String(sessionOtp)) {
      // Proceed to reset password page
      req.session.userData = { email: req.session.userData.email };

      return res
        .status(200)
        .json({ success: true, redirectUrl: "/change-password" });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP. Please try again.99" });
    }
  } catch (error) {
    console.error("Error in verifyForgotPasswordOtp:", error);
    res.status(500).json({ success: false, message: "An error occurred." });
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
    res.status(500).send("Server error");
  }
};

const changePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match." });
    }

    const user = req.session.userData;

    if (!user || !user.email) {
      return res.status(401).json({
        success: false,
        message: "User session expired. Please log in again.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the password instead of creating a new user
    const passwordChange = await userSchema.updateOne(
      { email: user.email },
      { $set: { password: hashedPassword } }
    );

    if (passwordChange.modifiedCount > 0) {
      req.session.save(() => {
        console.log("Session saved.");
        res.status(200).json({
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
      res.status(400).json({
        success: false,
        message: "Password not updated. Try a new password.",
      });
    }
  } catch (error) {
    console.error("Error in changing the password:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const resendPswrdOtp = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    const { email } = req.session.userData;

    if (!email) {
      return res
        .status(400)
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
        .status(200)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error resending OTP", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try later.",
    });
  }
};

const productDetails = async (req, res) => {
  try {
    const productId = req.query.id;

    const products = await Product.findById(productId).lean();

    const categories = await Category.find({ isListed: true });

    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      quantity: { $gt: 0 },
    });

    // Get latest 4 products (optional logic)
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
      product: products,
      products: productData,
    });

  } catch (error) {
    console.error("Error in rendering home page:", error);
    res.status(500).send("Server error");
  }
};

// const mensCategory= async(req,res)=>{
//   try{
//     const categories = await Category.find({ isListed: true,name:{$regex:'Mens'} });

//     let productData = await Product.find({
//       isBlocked: false,
//       category: { $in: categories.map((category) => category._id) },
//       quantity: { $gt: 0 },
//     });

//     // Get latest 4 products (optional logic)
//     productData = productData.slice().map((product) => {
//       return {
//         ...product._doc,
//         firstImage:
//           product.productImages && product.productImages.length > 0
//             ? product.productImages[0]
//             : "default.jpg",
//       };
//     });
    
//     res.render("user/mens", {
//       title: "Women Category",
//       adminHeader: true,
//       hideFooter: true,
//       products: productData,
//     });
//   }catch(error){
//     console.error("Error in rendering home page:", error);
//     res.status(500).send("Server error");
//   }
// }

const mensCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page
    const limit = 2; // Products per page
    const skip = (page - 1) * limit;

    // Find categories related to "Mens"
    const categories = await Category.find({
      isListed: true,
      name: { $regex: 'Mens' }
    });

    const categoryIds = categories.map((cat) => cat._id);

    // Total count for pagination
    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    // Paginated product query
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
    res.status(500).send("Server error");
  }
};


const womensCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page
    const limit = 2; // Products per page
    const skip = (page - 1) * limit;

    // Find categories related to "Mens"
    const categories = await Category.find({
      isListed: true,
      name: { $regex: 'Womens',$options:'i' }
    });

    const categoryIds = categories.map((cat) => cat._id);

    // Total count for pagination
    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    // Paginated product query
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
    res.status(500).send("Server error");
  }
};


const beautyCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page
    const limit = 2; // Products per page
    const skip = (page - 1) * limit;

    // Find categories related to "Mens"
    const categories = await Category.find({
      isListed: true,
      name: { $regex: 'Beauty',$options:'i' }
    });

    const categoryIds = categories.map((cat) => cat._id);

    // Total count for pagination
    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    // Paginated product query
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
    res.status(500).send("Server error");
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

    // Filter by price range 
    if (price) {
      let priceRange = price.split('-');
      if (priceRange.length === 2) {
        filter.salePrice = { $gte: parseInt(priceRange[0]), $lte: parseInt(priceRange[1]) };
      } else if (priceRange[0] === '8000+') {
        filter.salePrice = { $gte: 8000 };
      }
    }

    
    const totalProducts = await Product.countDocuments(filter);

    
    const totalPages = Math.ceil(totalProducts / limit);

  
    let products = await Product.find(filter)
      .skip(skip)
      .limit(limit);

    
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

    
    res.render('user/mens', {
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
    res.status(500).send('Server Error');
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

};
