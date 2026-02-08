const Leaderboard = require("../models/LeaderBoard");
const mongoose = require("mongoose");
const sendAdminNotificationEmail = require("../utils/sendAdminNotificationEmail");

/* ==============================
   UTIL: Mask Instagram Username
   abcdefg → abc****
================================ */
function maskUsername(username) {
  if (!username || username.length <= 3) return "***";
  return username.slice(0, 3) + "*".repeat(username.length - 3);
}

/* ==============================
   1️⃣ GET /users
   List leaderboard (paginated)
================================ */
exports.getUsers = async (req, res) => {
  try {
    let { offset = 0, limit = 10 } = req.query;

    offset = Math.max(parseInt(offset, 10), 0);
    limit = Math.min(Math.max(parseInt(limit, 10), 1), 50);

    const [users, total] = await Promise.all([
      Leaderboard.find({})
        .sort({ totalPoints: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),

      Leaderboard.countDocuments(),
    ]);

    const response = users.map(u => ({
      instagramUsername: maskUsername(u.instagramUsername),
      followersCount: u.followersCount,
      orderPoints: u.orderPoints,
      premiumPoints: u.premiumPoints,
      consistencyPoints: u.consistencyPoints,
      totalPoints: u.totalPoints,
    }));

    return res.status(200).json({
      data: response,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + response.length < total,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch leaderboard users",
    });
  }
};

/* ==============================
   2️⃣ GET /user/:instagramUsername
   Single leaderboard user
================================ */
exports.getUserByUsername = async (req, res) => {
  try {
    const { instagramUsername } = req.params;

    const user = await Leaderboard.findOne({
      instagramUsername,
    }).lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found in leaderboard",
      });
    }

    return res.status(200).json({
      instagramUsername: user.instagramUsername,
      followersCount: user.followersCount,
      orderPoints: user.orderPoints,
      premiumPoints: user.premiumPoints,
      consistencyPoints: user.consistencyPoints,
      totalPoints: user.totalPoints,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch user details",
    });
  }
};

/* ==============================
   3️⃣ UPDATE /user/:instagramUsername
   Request followers update (EMAIL ONLY)
================================ */
exports.requestFollowersUpdate = async (req, res) => {
  try {
    const { instagramUsername } = req.params;
    const { followers_count } = req.body;

    if (
      followers_count === undefined ||
      typeof followers_count !== "number" ||
      followers_count < 0
    ) {
      return res.status(400).json({
        message: "Invalid followers_count",
      });
    }

    // 🔔 Email only (NO DB UPDATE)
    await sendAdminNotificationEmail({
      to: "business@kancheepuramsmsilks.net",
      subject: "Follower Count Update Request",
      body: `
        Instagram User: ${instagramUsername}
        Requested Followers Count: ${followers_count}
      `,
    });

    return res.status(200).json({
      message:
        "Follower count update request sent. Will be updated after verification.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to request followers update",
    });
  }
};

/* ==============================
   4️⃣ UPDATE /admin/:instagramUsername
   Admin-approved followers update
================================ */
exports.adminUpdateFollowers = async (req, res) => {
  try {
    const adminToken = req.headers["admin-token"];

    if (adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({
        message: "Invalid admin token",
      });
    }

    const { instagramUsername } = req.params;
    const { followers_count } = req.body;

    if (
      followers_count === undefined ||
      typeof followers_count !== "number" ||
      followers_count < 0
    ) {
      return res.status(400).json({
        message: "Invalid followers_count",
      });
    }

    const updated = await Leaderboard.findOneAndUpdate(
      { instagramUsername },
      { $set: { followersCount: followers_count } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Leaderboard user not found",
      });
    }

    return res.status(200).json({
      message: "Followers count updated successfully",
      instagramUsername,
      followersCount: followers_count,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Admin update failed",
    });
  }
};