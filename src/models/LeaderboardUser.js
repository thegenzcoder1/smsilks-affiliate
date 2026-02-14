const mongoose = require("mongoose");

const leaderboardUserSchema = new mongoose.Schema({
  instagramUsername: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
      email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Invalid email format",
      ],
    }
});

module.exports = mongoose.model(
  "LeaderboardUser",
  leaderboardUserSchema
);
