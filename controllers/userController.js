const userSchmea = require("../models/userSchema");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const signup = async (req, res) => {
  try {
    let { name, email, phone, password } = req.body;

    const user = await userSchmea.findOne({ email });
    const phoneNumber = await userSchmea.findOne({ phone });
    if (user || phoneNumber) {
      return res.redirect(
        "/signup?message=" +
          encodeURIComponent(
            "Email or phone number already in use. Please use a different one."
          ) +
          "&t=" +
          Date.now()
      );
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new userSchmea({
      name,
      email,
      phone,
      password: hashedPassword,
    });

    const done = await newUser.save();
    console.log(newUser);
    if (done) {
      // return res.redirect("/login");
      return res.redirect(
        "/login?message=" +
          encodeURIComponent("User created successfully") +
          "&t=" +
          Date.now()
      );
    }
  } catch (error) {
    console.error("Error in saving user", error);
    res.status(500).send("Internal server error");
  }
};

const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    const user = await userSchmea.findOne({ email }).select("+password");

    if (!user || !user.password) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    

    if (!isMatch) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    req.session.user = true;
    res.redirect("/")
  } catch (error) {
    console.error("Error in saving user", error);
    res.status(500).send("Internal server error");
  }
};

const loadHomepage = async (req, res) => {
  try {
    return res.render("user/home", { title: "Trenaura-Home page" });
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
      message: req.query.message,
    });
  } catch (error) {
    console.error("Error in rendering signup page:", error);
    res.status(500).send("Server error");
  }
};

module.exports = {
  loadHomepage,
  pageNotFound,
  loadLogin,
  loadSignup,
  signup,
  login,
};
