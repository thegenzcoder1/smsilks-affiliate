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
});

module.exports = mongoose.model(
  "LeaderboardUser",
  leaderboardUserSchema
);
