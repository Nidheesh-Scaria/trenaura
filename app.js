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

const app = express();
db();

const port = process.env.PORT || 3000;


const hbs = exphbs.create({
  extname: "hbs",
  defaultLayout: "layout",
  layoutsDir: path.join(__dirname, "views"),
  partialsDir: path.join(__dirname, "views/partials"),
  helpers: {
    increment: (value) => parseInt(value) + 1,
    decrement: (value) => parseInt(value) - 1,
    ifCond: function (v1, operator, v2, options) {
      switch (operator) {
        case "===":
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case ">":
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case "<":
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    },
    range: function (start, end) {
      const arr = [];
      for (let i = start; i <= end; i++) {
        arr.push(i);
      }
      return arr;
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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.listen(port, () => console.log(`Server running at ${port}`));

module.exports = app;
