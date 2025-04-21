const express = require("express");
const db = require("./config/db");
const hbs = require("hbs");
const path = require("path");
const userRouter = require("./routes/userRouter");
const exphbs = require('express-handlebars');

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
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", userRouter);

app.listen(port, () => console.log(`Server runnig at ${port}`));

module.exports = app;
