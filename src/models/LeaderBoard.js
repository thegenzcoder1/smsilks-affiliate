// models/Leaderboard.js
const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema(
  {
    instagramUsername: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    followersCount: {
      type: Number,
      required: true,
      min: 0,
    },

    orderPoints: {
      type: Number,
      default: 0,
    },

    premiumPoints: {
      type: Number,
      default: 0,
    },

    consistencyPoints: {
      type: Number,
      default: 0,
    },

    totalPoints: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Leaderboard", leaderboardSchema);