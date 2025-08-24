const userSchema = require("../models/userSchema");
const bcrypt = require("bcrypt");
const httpStatus=require('../util/statusCodes')
const {MESSAGES}=require('../util/constants')

const loadLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.redirect("/admin/dashboard");
    } else {
      return res.render("admin/adminLogin", {
        title: "Trenaura-Admin Login page",
        hideHeader: true,
        hideFooter: true,
        adminHeader: true,
        messages: req.flash("error"),
      });
    }
  } catch (error) {
    console.error("Error in rendering login page:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("Missing email or password from form!");
      req.flash("error", "Please fill in all fields.");
      return res.redirect("/admin/login");
    }

    const admin = await userSchema
      .findOne({ email, isAdmin: true })
      .select("+password");

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        req.session.user = admin;
        return res.redirect("/admin/dashboard");
      } else {
        req.flash("error", "Invalid username or password");
        return res.redirect("/admin/login");
      }
    } else {
      req.flash("error", "Invalid username or password");
      return res.redirect("/admin/login");
    }
  } catch (error) {
    console.log("Login error", error);
    return res.redirect("/pageNotFound");
  }
};


const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      return res.render("admin/dashboard", {
        title: "Admin Dashboard - Trenaura",
        hideHeader: true,
        hideFooter: true,
        adminHeader: false,
      });
    } catch (error) {
      console.error("Error rendering dashboard:", error);
      return res.redirect("/pageNotFound");
    }
  } else {
    return res.redirect("/admin/login");
  }
};


const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.redirect("/pageNoteFound");
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.error("Error in admin logout:", error);
    res.redirect("/pageNoteFound");
  }
};



module.exports = {
  loadLogin,
  login,
  loadDashboard,
  logout,
  
};
