const userSchema = require("../models/userSchema");

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

const userBlocked = async (req, res, next) => {
  if (req.session.isLoggedIn) {
    try {
      const userId = req.session.user;
      if (!userId) {
        return res.redirect("/login");
      }

      const user = await userSchema.findById(userId);
      if (!user) {
        res.session.destroy(() => {
          return res.redirect("/login");
        });
      }

      if (user.isBlocked) {
        res.cookie(
          "blockMessage",
          "You have been blocked. Please contact support.",
          {
            maxAge: 3000,
            httpOnly: true,
          }
        );
        
        req.session.destroy((err) => {
          if (err) {
            console.log("Error in destroying at middleware", err);
            return res.redirect("/pageNotfound");
          }

          return res.redirect("/login");
        });
      } else {
        next();
      }
    } catch (error) {
      console.error("Error in userBlocked middleware:", error);
      res.redirect("/pageNotfound");
    }
  } else {
    next();
  }
};

module.exports = {
  checkSession,
  isLoggedIn,
  adminAuth,
  userBlocked,
};
