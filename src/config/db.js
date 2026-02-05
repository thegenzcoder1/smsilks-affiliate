const mongoose = require("mongoose");

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null };

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  try {
    cached.conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
    return cached.conn;
  } catch (error) {
    console.error("❌ MongoDB Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
