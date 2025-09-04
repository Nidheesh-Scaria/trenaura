const express = require("express");
const db = require("./config/db");
const path = require("path");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const exphbs = require("express-handlebars");
const session = require("express-session");
const flash = require("connect-flash");
const nocache = require("nocache");
const passport = require("./config/passport");
const { GridFSBucket } = require("mongodb");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const Cart = require("./models/cartSchema");

const app = express();

const port = process.env.PORT || 3000;

db();

mongoose.connection.once("open", () => {
  const db = mongoose.connection.db;
  const bucket = new GridFSBucket(db, { bucketName: "uploads" });
  app.locals.bucket = bucket;

  console.log("Grid fs set in app.locals");
});

const hbs = exphbs.create({
  extname: "hbs",
  defaultLayout: "layout",
  layoutsDir: path.join(__dirname, "views"),
  partialsDir: path.join(__dirname, "views/partials"),
  helpers: {
    increment(value, step) {
      if (typeof step === "object" || step === undefined) step = 1;
      const v = Number(value);
      const s = Number(step);
      return (isNaN(v) ? 0 : v) + (isNaN(s) ? 1 : s);
    },

    decrement(value, step) {
      if (typeof step === "object" || step === undefined) step = 1;
      const v = Number(value);
      const s = Number(step);
      return (isNaN(v) ? 0 : v) - (isNaN(s) ? 1 : s);
    },

    multiply(a, b) {
      const x = Number(a),
        y = Number(b);
      return isNaN(x) || isNaN(y) ? 0 : x * y;
    },

    ifCond(v1, operator, v2, options) {
      switch (operator) {
        case "===":
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case ">":
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case "<":
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case ">=":
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case "<=":
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    },

    range(start, end) {
      const s = Number(start),
        e = Number(end);
      const arr = [];
      for (let i = s; i <= e; i++) arr.push(i);
      return arr;
    },

    eq: (a, b) => a === b,
    ne: (a, b) => a !== b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    gte: (a, b) => a >= b,
    lte: (a, b) => a <= b,

    and: function () {
      return Array.prototype.every.call(arguments, Boolean);
    },
    or: function () {
      return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    },

    formatDate: function (date) {
      if (!date) return "";
      const options = { day: "2-digit", month: "short", year: "numeric" };
      return new Date(date).toLocaleDateString("en-GB", options);
    },
  },
});

app.engine("hbs", hbs.engine);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(flash());
app.use(nocache());
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());

app.use((req, res, next) => {
  res.locals.JSONstringify = (obj) =>
    JSON.stringify(obj)
      .replace(/<\/script/g, "<\\/script")
      .replace(/<!--/g, "<\\!--");
  res.locals.isLoggedIn = req.session.isLoggedIn || false;
  res.locals.user = req.session.user || null;
  next();
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route to serve GridFS images
app.get("/images/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const bucket = req.app.locals.bucket;

    if (!bucket) {
      return res.status(500).send("GridFS not initialized");
    }

    const downloadStream = bucket.openDownloadStreamByName(filename);

    downloadStream.on("error", (error) => {
      console.error("Error downloading file:", error);
      res.status(404).send("Image not found");
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error("Error serving image:", error);
    res.status(500).send("Internal server error");
  }
});

//passing cart length
app.use(async (req, res, next) => {
  if (req.session.user) {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).lean();
    const cartLength = cart?.items?.length || 0;
    res.locals.cartLength = cartLength;
  } else {
    res.locals.cartLength = 0;
  }
  next();
});

//route
app.use("/", userRouter);
app.use("/admin", adminRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  console.log("404 - Route not found:", req.method, req.url);
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.listen(port, () => console.log(`Server is running at ${port}`));

module.exports = app;
