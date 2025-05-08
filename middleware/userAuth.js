const user = require("../models/userSchema");

const checkSession = (req, res, next) => {
  if (req.session.isLoggedIn) {
    next();
  } else {
    res.redirect("/login");
  }
};


const isLoggedIn = (req, res, next) => {
  if (req.session.isLoggedIn) {
    res.redirect("/");
  } else {
    next();
  }
};



const adminAuth = (req, res, next) => {
  try {
    if (req.session && req.session.admin) {
      next();
    } else {
      res.redirect("/admin/login");
    }
  } catch (error) {
    console.log("Error in admin auth middleware", error);
    res.redirect("/pageNotfound");
  }
};


module.exports = {
  checkSession,
  isLoggedIn,
  adminAuth,
  
};
