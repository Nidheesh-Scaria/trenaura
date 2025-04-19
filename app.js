const express = require("express");
const db=require("./config/db")


const app = express();
db()

var port = process.env.PORT || 300;

app.listen(port, () => console.log("Server runnig"));

module.exports = app;
