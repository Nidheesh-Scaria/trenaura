const express = require("express");
const db = require("./config/db");
const hbs = require("hbs");
const path = require("path");
const userRouter = require("./routes/userRouter");
const exphbs = require("express-handlebars");
const session = require("express-session");
const flash = require("connect-flash");
const nocache = require("nocache");
const passport = require("./config/passport");

const app = express();
db();

var port = process.env.PORT || 3000;

app.engine(
  "hbs",
  exphbs.engine({
    extname: "hbs",
    defaultLayout: "layout",
    layoutsDir: path.join(__dirname, "views"),
    partialsDir: path.join(__dirname, "views/partials"),
  })
);

app.use(
  session({
    secret: "your-secret",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(flash());

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(nocache());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 600000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/", userRouter);

app.listen(port, () => console.log(`Server runnig at ${port}`));

module.exports = app;
