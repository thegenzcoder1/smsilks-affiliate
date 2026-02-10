// controllers/email.controller.js
const Leaderboard = require("../models/LeaderBoard");
const PromoCode = require("../models/PromoCode");
const Saree = require("../models/Saree");
const InstagramPurchase = require("../models/InstagramPurchase");
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
    }).lean();

    if (!promo || promo.details.length === 0) {
      return res.status(404).json({ message: "Invalid PromoCode" });
    }

    /* ---------- DUPLICATE CHECK ---------- */
    const sareeIds = saree.map(s => s.sareeId);

    const existingSarees = await Saree.find({
      sareeId: { $in: sareeIds },
    }).lean();

    if (existingSarees.length > 0) {
      return res.status(409).json({
        message: `Saree already exists: ${existingSarees
          .map(s => s.sareeId)
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
      saree.map(s => ({
        sareeId: s.sareeId,
        sareeName: s.sareeName,
      })),
      { session }
    );

    const sareeBoughtCount = saree.length;
    const sareeNames = saree.map(s => s.sareeName).join(", ");

    let purchaseDoc = await InstagramPurchase.findOne(
      { promoCode: normalizedPromoCode },
      null,
      { session }
    );

    const purchaseEntries = promo.details.map(a => ({
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
          totalBill * (affiliate.discountPercentage / 100)
        ),
      };

      const sent = await sendEmailWithRetry(
        affiliate.email,
        normalizedPromoCode,
        payload
      );

      if (!sent) throw new Error("Email failed");
    }

    /* ---------- LEADERBOARD ---------- */
    for (const affiliate of promo.details) {
      const username = affiliate.affiliateInstagramUsername;

      let leaderboard = await Leaderboard.findOne(
        { instagramUsername: username },
        null,
        { session }
      );

      const followersCount = leaderboard?.followersCount ?? 0;
      const normalize = getNormalizeMultiplier(followersCount);

      const orderPointsEarned =
        sareeBoughtCount * 10 * normalize;

      const premiumPointsEarned =
        getPremiumPoints(followersCount);

      if (!leaderboard) {
        leaderboard = new Leaderboard({
          instagramUsername: username,
          followersCount,
          orderPoints: orderPointsEarned,
          premiumPoints: premiumPointsEarned,
          consistencyPoints: 5,
        });
      } else {
        leaderboard.orderPoints += orderPointsEarned;
        leaderboard.premiumPoints += premiumPointsEarned;
        leaderboard.consistencyPoints += 5;
      }

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
    await session.abortTransaction();
    return res.status(500).json({
      message: "Transaction failed",
      error: err.message,
    });
  } finally {
    session.endSession();
  }
};
