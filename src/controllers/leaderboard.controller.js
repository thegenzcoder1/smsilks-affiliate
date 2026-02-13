const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
const Leaderboard = require("../models/LeaderBoard");
const LeaderboardUser = require("../models/LeaderboardUser");
const PromoCode = require("../models/PromoCode");
const InstagramPurchase = require("../models/InstagramPurchase");

const mongoose = require("mongoose");

/* ==============================
   UTIL: Mask Instagram Username
   abcdefg → abc****
================================ */
function maskUsername(username) {
  if (!username || username.length <= 3) return "***";
  return username.slice(0, 3) + "*".repeat(username.length - 3);
}

exports.getUsersForAdmin = async (req, res) => {
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
      instagramUsername: u.instagramUsername,
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
    const { instagramUsername } = req.user;

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
await resend.emails.send({
      from: "affiliate-noreply@kancheepuramsmsilks.net",
      to: "business@kancheepuramsmsilks.net",
      subject: "📢 Follower Count Update Request",
      html: `
        <h2>Follower Count Update Request 🔔</h2>

        <p>An influencer has requested a followers count update.</p>

        <hr />

        <p><strong>Instagram Username:</strong> ${instagramUsername}</p>
        <p><strong>Requested Followers Count:</strong> ${followers_count}</p>

        <hr />

        <p>
          Please verify the follower count manually and approve the update
          via the Admin API.
        </p>

        <br />

        <p>
          Regards,<br />
          <strong>Kancheepuram SM Silks – Affiliate System</strong>
        </p>
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





exports.adminDeleteLeaderboardUser = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const adminToken = req.headers["admin-token"];

    if (adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({
        message: "Invalid admin token",
      });
    }

    const { instagramUsername } = req.params;

    if (!instagramUsername) {
      return res.status(400).json({
        message: "instagramUsername is required",
      });
    }

    const username = instagramUsername.trim().toLowerCase();

    session.startTransaction();

    /* ---------------------------------
       1️⃣ Delete Leaderboard entry
    ---------------------------------- */
    const deletedLeaderboard = await Leaderboard.findOneAndDelete(
      { instagramUsername: username },
      { session }
    );

    if (!deletedLeaderboard) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Leaderboard user not found",
      });
    }

    /* ---------------------------------
       2️⃣ Delete Auth user
    ---------------------------------- */
    await LeaderboardUser.findOneAndDelete(
      { instagramUsername: username },
      { session }
    );

    /* ---------------------------------
       3️⃣ Remove from ALL PromoCodes
       (Pull from embedded details array)
    ---------------------------------- */
    await PromoCode.updateMany(
      {
        "details.affiliateInstagramUsername": username,
      },
      {
        $pull: {
          details: {
            affiliateInstagramUsername: username,
          },
        },
      },
      { session }
    );

    /* ---------------------------------
       4️⃣ Commit
    ---------------------------------- */
    await session.commitTransaction();

    return res.status(200).json({
      message:
        "Leaderboard, Auth user, and all promoCode affiliations removed successfully",
      deletedUsername: username,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(error);

    return res.status(500).json({
      message: "Admin delete failed",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};



/*
GET /api/leaderboard/user
Returns purchase history for logged-in affiliate
*/
exports.getAffiliatePurchaseHistory = async (req, res) => {
  try {
    // ✅ Extract username from JWT middleware
    const {instagramUsername} = req.user;
    const affiliateUsername = instagramUsername;

    const purchases = await InstagramPurchase.find({
      "purchases.affiliateInstagramUsername": affiliateUsername,
    }).lean();

    if (!purchases || purchases.length === 0) {
      return res.status(200).json({
        message: "No purchases found",
        data: [],
      });
    }

    // 🔎 Filter only relevant purchases per promoCode
    const result = purchases.map(doc => {
      const filtered = doc.purchases.filter(
        p =>
          p.affiliateInstagramUsername.toLowerCase() ===
          affiliateUsername
      );

      return {
        promoCode: doc.promoCode,
        purchases: filtered,
      };
    }).filter(r => r.purchases.length > 0);

    return res.status(200).json({
      affiliateInstagramUsername: affiliateUsername,
      totalPromoCodes: result.length,
      data: result,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch purchase history",
      error: error.message,
    });
  }
};
