const mongoose = require("mongoose");
const env = require("dotenv").config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Database connected: ${conn.connection.host}`);
  } catch (error) {
    console.log("An error occured while conecting DB:",error);
    process.exit(1);
  }
};

module.exports = connectDB;
