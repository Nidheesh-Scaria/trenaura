const { GridFSBucket } = require("mongodb");
const mongoose = require("mongoose");

function initGridFS(app) {
  mongoose.connection.once("open", () => {
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: "uploads" });
    app.locals.bucket = bucket;
    console.log("GridFS initialized");
  });
}

module.exports = initGridFS;
