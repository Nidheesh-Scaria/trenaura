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



const app = express();



const port = process.env.PORT || 3000;

db();

mongoose.connection.once('open',()=>{
  const db=mongoose.connection.db;
  const bucket=new GridFSBucket(db,{bucketName:'uploads'})
  app.locals.bucket=bucket

  console.log('Grid fs set in app.locals')
})


const hbs = exphbs.create({
  extname: "hbs",
  defaultLayout: "layout",
  layoutsDir: path.join(__dirname, "views"),
  partialsDir: path.join(__dirname, "views/partials"),
  helpers: {
    increment: (index, offset) => parseInt(index) + parseInt(offset || 0) + 1,
    decrement: (value) => parseInt(value) - 1,
    multiply: (a, b) => parseInt(a) * parseInt(b),

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
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route to serve GridFS images
app.get('/images/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const bucket = req.app.locals.bucket;
    
    if (!bucket) {
      return res.status(500).send('GridFS not initialized');
    }

    const downloadStream = bucket.openDownloadStreamByName(filename);
    
    downloadStream.on('error', (error) => {
      console.error('Error downloading file:', error);
      res.status(404).send('Image not found');
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).send('Internal server error');
  }
});

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.listen(port, () => console.log(`Server running at ${port}`));

module.exports = app;
