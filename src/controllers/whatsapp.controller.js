// controllers/email.controller.js
const Leaderboard = require("../models/LeaderBoard");
const PromoCode = require("../models/PromoCode");
const Saree = require("../models/Saree");
const InstagramPurchase = require("../models/InstagramPurchase");
const PromoCodeLead = require("../models/PromoCodeLead");
const mongoose = require("mongoose");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const {
  getNormalizeMultiplier,
  getPremiumPoints,
} = require("../utils/leaderboardPoints");

/* ================================
   EMAIL SENDER
================================ */
async function sendEmailViaResend(to, promoCode, payload) {
  const {
    instagramUsername,
    instagramUserPhone,
    sareeBought,
    sareeNames,
    billAmount,
    discountPercentage,
    affiliateAmount,
  } = payload;

  await resend.emails.send({
    from: "affiliate-noreply@kancheepuramsmsilks.net",
    to,
    subject: `New Instagram Sale | Promo Code: ${promoCode}`,
    html: `
      <h2>New Instagram Sale 🎉</h2>

      <p><strong>Promo Code:</strong> ${promoCode}</p>
      <p><strong>Instagram Username:</strong> ${instagramUsername}</p>
      <p><strong>Customer Phone:</strong> ${instagramUserPhone}</p>

      <hr />

      <p><strong>Sarees Bought:</strong> ${sareeBought}</p>
      <p><strong>Saree Names:</strong> ${sareeNames}</p>

      <hr />

      <p><strong>Total Bill:</strong> Rs. ${billAmount}</p>
      <p><strong>Your Discount:</strong> ${discountPercentage}%</p>
      <p><strong>Your Earnings:</strong> Rs. ${affiliateAmount}</p>
    `,
  });
}

/* ================================
   RETRY WRAPPER
================================ */
async function sendEmailWithRetry(to, promoCode, payload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendEmailViaResend(to, promoCode, payload);
      return true;
    } catch (err) {
      console.error(`Email attempt ${attempt} failed`, err.message);
      if (attempt === maxRetries) return false;
    }
  }
}

/* ================================
   MAIN CONTROLLER
================================ */
exports.sendEmailNotification = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      promoCode,
      instagramUsername,
      instagramUserPhone,
      saree,
      totalBill,
    } = req.body;

    /* ---------- VALIDATION ---------- */
    if (
      !promoCode ||
      !instagramUsername ||
      !instagramUserPhone ||
      !Array.isArray(saree) ||
      saree.length === 0 ||
      !totalBill
    ) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const normalizedPromoCode = promoCode.toUpperCase().trim();
    const customerUsername = instagramUsername.trim();
    const customerPhone = instagramUserPhone.trim();

    /* ---------- PROMO ---------- */
    const promo = await PromoCode.findOne({
      promoCode: normalizedPromoCode,
    });

    if (!promo) {
      return res.status(404).json({ message: "Invalid PromoCode" });
    }

    if (promo.details.length === 0) {
      return res.status(404).json({ message: "No Affiliate Present For This PromoCode" });
    }

    /* ---------- DUPLICATE CHECK ---------- */
    const sareeIds = saree.map((s) => s.sareeId);

    const existingSarees = await Saree.find({
      sareeId: { $in: sareeIds },
    }).lean();

    if (existingSarees.length > 0) {
      return res.status(409).json({
        message: `Saree already exists: ${existingSarees
          .map((s) => s.sareeId)
          .join(", ")}`,
      });
    }

    const used = await InstagramPurchase.findOne({
      promoCode: normalizedPromoCode,
      "purchases.instaUsername": customerUsername,
    }).lean();

    if (used) {
      return res.status(409).json({
        message: "Promo already used by this customer",
      });
    }

    /* ---------- TRANSACTION ---------- */
    session.startTransaction();

    await Saree.insertMany(
      saree.map((s) => ({
        sareeId: s.sareeId,
        sareeName: s.sareeName,
      })),
      { session },
    );

    const sareeBoughtCount = saree.length;
    const sareeNames = saree.map((s) => s.sareeName).join(", ");

    let purchaseDoc = await InstagramPurchase.findOne(
      { promoCode: normalizedPromoCode },
      null,
      { session },
    );

    const purchaseEntries = promo.details.map((a) => ({
      instaUsername: customerUsername,
      affiliateInstagramUsername: a.affiliateInstagramUsername,
      instaUserPhone: customerPhone,
      sareeBought: sareeBoughtCount,
      totalBill,
      emailMessageSent: true,
    }));

    if (!purchaseDoc) {
      purchaseDoc = new InstagramPurchase({
        promoCode: normalizedPromoCode,
        purchases: purchaseEntries,
      });
    } else {
      purchaseDoc.purchases.push(...purchaseEntries);
    }

    await purchaseDoc.save({ session });

    /* ---------- EMAILS ---------- */
    for (const affiliate of promo.details) {
      const payload = {
        instagramUsername: customerUsername,
        instagramUserPhone: customerPhone,
        sareeBought: sareeBoughtCount,
        sareeNames,
        billAmount: totalBill,
        discountPercentage: affiliate.discountPercentage,
        affiliateAmount: Math.round(
          totalBill * (affiliate.discountPercentage / 100),
        ),
      };

      const sent = await sendEmailWithRetry(
        affiliate.email,
        normalizedPromoCode,
        payload,
      );

      if (!sent) throw new Error("Email failed");
    }

    /* =========================================================
       🔥 NEW: LEAD AUTO-CONVERSION (SAFE & TRANSACTIONAL)
    ========================================================== */
    
    await PromoCodeLead.updateOne(
      {
        promoCode: normalizedPromoCode,
        instagramUsername: customerUsername,
        isConverted: false,
      },
      {
        $set: {
          isConverted: true,
          convertedAt: new Date(),
        },
      },
      { session },
    );

    /* ---------- LEADERBOARD ---------- */
  for (const affiliate of promo.details) {
    const username = affiliate.affiliateInstagramUsername;

    // Skip your own Instagram if required
    if (username === process.env.MY_INSTAGRAM_USERNAME) continue;

    // 🔎 STRICT: Must exist
    const leaderboard = await Leaderboard.findOne(
      { instagramUsername: username },
      null,
      { session }
    );

    if (!leaderboard) {
      throw new Error(
        `Leaderboard user not found for ${username}. Aborting transaction.`
      );
    }

    // 🚫 DO NOT TOUCH followersCount
    const followersCount = leaderboard.followersCount;

    const normalize = getNormalizeMultiplier(followersCount);

    const orderPointsEarned =
      sareeBoughtCount * 10 * normalize;

    const premiumPointsEarned =
      getPremiumPoints(followersCount);

    // ✅ Only update existing values
    leaderboard.orderPoints += orderPointsEarned;
    leaderboard.premiumPoints += premiumPointsEarned;
    leaderboard.consistencyPoints += 25;

    leaderboard.totalPoints =
      leaderboard.orderPoints +
      leaderboard.premiumPoints +
      leaderboard.consistencyPoints;

    await leaderboard.save({ session });
  }


    await session.commitTransaction();

    return res.status(200).json({
      message: "Purchase, emails & leaderboard updated successfully",
    });
  } catch (err) {
    console.error(err);
    await session.abortTransaction();
    return res.status(500).json({
      message: "Transaction failed",
      error: err.message,
    });
  } finally {
    session.endSession();
  }
};

/* =========================================
   GET /api/purchases/:promoCode
========================================= */
exports.getPurchasesByPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.params;

    if (!promoCode) {
      return res.status(400).json({
        message: "promoCode is required",
      });
    }

    const normalizedPromoCode = promoCode.toUpperCase().trim();

    const purchaseDoc = await InstagramPurchase.findOne({
      promoCode: normalizedPromoCode,
    }).lean();

    if (!purchaseDoc) {
      return res.status(404).json({
        message: "No purchases found for this promoCode",
      });
    }

    return res.status(200).json({
      promoCode: normalizedPromoCode,
      totalPurchases: purchaseDoc.purchases.length,
      purchases: purchaseDoc.purchases,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch purchases",
      error: error.message,
    });
  }
};

/* =========================================
   DELETE /api/purchases
   Body: { promoCode, instagramUsername }
========================================= */
exports.deletePurchaseByUsername = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { promoCode, instaUsername } = req.body;

    if (!promoCode || !instaUsername) {
      return res.status(400).json({
        message: "promoCode and instaUsername required",
      });
    }

    const normalizedPromoCode = promoCode.toUpperCase().trim();
    const customerUsername = instaUsername.trim();

    session.startTransaction();

    /* ---------- FIND PURCHASE ---------- */
    const purchaseDoc = await InstagramPurchase.findOne(
      { promoCode: normalizedPromoCode },
      null,
      { session },
    );

    if (!purchaseDoc) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "PromoCode not found",
      });
    }

    const purchase = purchaseDoc.purchases.find(
      (p) => p.instaUsername === customerUsername,
    );

    if (!purchase) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Purchase not found",
      });
    }

    const sareeBoughtCount = purchase.sareeBought;
    const affiliateUsername = purchase.affiliateInstagramUsername;

    /* ---------- REMOVE PURCHASE ---------- */
    purchaseDoc.purchases = purchaseDoc.purchases.filter(
      (p) => p.instaUsername !== customerUsername,
    );

    await purchaseDoc.save({ session });

    /* ---------- ROLLBACK LEADERBOARD ---------- */
    const leaderboard = await Leaderboard.findOne(
      { instagramUsername: affiliateUsername },
      null,
      { session },
    );

    if (leaderboard) {
      const normalize = getNormalizeMultiplier(leaderboard.followersCount);

      const orderPointsToReverse = sareeBoughtCount * 10 * normalize;

      const premiumPointsToReverse = getPremiumPoints(
        leaderboard.followersCount,
      );

      // Reverse safely (never go negative)
      leaderboard.orderPoints = Math.max(
        0,
        leaderboard.orderPoints - orderPointsToReverse,
      );

      leaderboard.premiumPoints = Math.max(
        0,
        leaderboard.premiumPoints - premiumPointsToReverse,
      );

      leaderboard.consistencyPoints = Math.max(
        0,
        leaderboard.consistencyPoints - 5,
      );

      leaderboard.totalPoints =
        leaderboard.orderPoints +
        leaderboard.premiumPoints +
        leaderboard.consistencyPoints;

      await leaderboard.save({ session });
    }

    await session.commitTransaction();

    return res.status(200).json({
      message: "Purchase deleted & leaderboard rolled back",
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({
      message: "Delete failed",
      error: err.message,
    });
  } finally {
    session.endSession();
  }
};
