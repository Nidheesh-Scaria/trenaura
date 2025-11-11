const session = require("express-session");

const userSession = session({
  name: "userSession",
  secret: process.env.SESSION_SECRET || "userSecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  },
});

const adminSession = session({
  name: "adminSession",
  secret: process.env.ADMIN_SESSION_SECRET || "adminSecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
});

module.exports = { userSession, adminSession };
