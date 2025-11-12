const express = require("express");
const path = require("path");
const nocache = require("nocache");
const flash = require("connect-flash");
const passport = require("./config/passport");
const cookieParser = require("cookie-parser");

const db = require("./config/db");
const hbs = require("./config/handlebars");
const initGridFS = require("./config/gridfs");
const { userSession, adminSession } = require("./middleware/session");
const localsMiddleware = require("./middleware/locals");
const errorHandler = require("./middleware/errorHandler");

const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const errorController=require('./controllers/errorController')

const app = express();

// Database
db();
//doing the coupon Expiry job
require("./config/couponExpiryJob");

initGridFS(app);

// Handlebars
app.engine("hbs", hbs.engine);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use("/admin", adminSession);
app.use("/", userSession);
app.use(flash());
app.use(nocache());
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());
app.use(localsMiddleware);
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

// Catch-all route for unknown paths
app.use("/admin/", errorController.adminPageNotFound);
app.use("/",errorController.userPageNotFound);


// GridFS image route
app.get("/images/:filename", (req, res) => {
  const bucket = req.app.locals.bucket;
  if (!bucket) return res.status(500).send("GridFS not initialized");

  const downloadStream = bucket.openDownloadStreamByName(req.params.filename);
  downloadStream.on("error", () => res.status(404).send("Image not found"));
  downloadStream.pipe(res);
});

// Error Handling
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
  console.log("404 - Route not found:", req.method, req.url);
  res.status(404).json({ success: false, message: "Route not found" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running at ${port}`));

module.exports = app;
