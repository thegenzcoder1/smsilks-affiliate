// controllers/email.controller.js
const PromoCode = require("../models/PromoCode");
const Saree = require("../models/Saree");
const InstagramPurchase = require("../models/InstagramPurchase");
const mongoose = require("mongoose");
const { Resend } = require("resend");

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

/* ================================
   EMAIL SENDER (RESEND)
================================ */
async function sendEmailViaResend(to, promoCode, payload) {
  const {
    instaUsername,
    instaUserPhone,
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
      <p><strong>Instagram Username:</strong> ${instaUsername}</p>
      <p><strong>Customer Phone:</strong> ${instaUserPhone}</p>

      <hr />

      <p><strong>Sarees Bought:</strong> ${sareeBought}</p>
      <p><strong>Saree Names:</strong> ${sareeNames}</p>

      <hr />

      <p><strong>Total Bill:</strong> Rs. ${billAmount}</p>
      <p><strong>Your Discount:</strong> ${discountPercentage}%</p>
      <p><strong>Your Earnings:</strong> Rs. ${affiliateAmount}</p>

      <br />
      <p>
        Thank you for partnering with <strong>Kancheepuram SMSilks</strong>.
      </p>
    `,
  });
}

/* ================================
   RETRY WRAPPER (3 ATTEMPTS)
================================ */
async function sendEmailWithRetry(to, promoCode, payload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendEmailViaResend(to, promoCode, payload);
      return true;
    } catch (err) {
      console.error(
        `Email attempt ${attempt} failed for ${to}`,
        err.message
      );
      if (attempt === maxRetries) return false;
    }
  }
}

/* ================================
   CONTROLLER
================================ */
const {
  getNormalizeMultiplier,
  getPremiumPoints,
} = require("../utils/leaderboardPoints");

exports.sendEmailNotification = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let {
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
      return res.status(400).json({ message: "Missing required fields" });
    }

    promoCode = promoCode.toUpperCase().trim();
    instagramUsername = instagramUsername.trim();

    /* ---------- PROMO ---------- */
    const promo = await PromoCode.findOne({ promoCode }).lean();
    if (!promo) {
      return res.status(404).json({ message: "PromoCode Not Found" });
    }

    const affiliates = promo.details.map(d => ({
      email: d.email,
      discountPercentage: d.discountPercentage,
      affiliateInstagramUsername: d.affiliateInstagramUsername,
    }));

    /* ---------- IDEMPOTENCY ---------- */
    const existingPurchase = await InstagramPurchase.findOne({
      promoCode,
      "purchases.instaUsername": instagramUsername,
    }).lean();

    if (existingPurchase) {
      return res.status(409).json({
        message: "Promo already used by this user",
      });
    }

    session.startTransaction();

    /* ---------- INSERT SAREES ---------- */
    await Saree.insertMany(
      saree.map(s => ({
        sareeId: s.sareeId,
        sareeName: s.sareeName,
      })),
      { session }
    );

    /* ---------- INSERT PURCHASE ---------- */
    let purchaseDoc = await InstagramPurchase.findOne(
      { promoCode },
      null,
      { session }
    );

    const newPurchases = affiliates.map(a => ({
      instaUsername: instagramUsername,
      affiliateInstagramUsername: a.affiliateInstagramUsername,
      instaUserPhone: instagramUserPhone,
      sareeBought: saree.length,
      totalBill,
      emailMessageSent: true,
    }));

    if (!purchaseDoc) {
      purchaseDoc = new InstagramPurchase({
        promoCode,
        purchases: newPurchases,
      });
    } else {
      purchaseDoc.purchases.push(...newPurchases);
    }

    await purchaseDoc.save({ session });

    /* ---------- SEND EMAILS (CRITICAL) ---------- */
    for (const affiliate of affiliates) {
      const sent = await sendEmailWithRetry(
        affiliate.email,
        promoCode,
        { instagramUsername, totalBill },
        3
      );

      if (!sent) throw new Error("Email failed");
    }

    /* ---------- LEADERBOARD UPSERT ---------- */
    for (const affiliate of affiliates) {
      const username = affiliate.affiliateInstagramUsername;

      let leaderboard = await Leaderboard.findOne(
        { instagramUsername: username },
        null,
        { session }
      );

      const followersCount = leaderboard?.followersCount || 0;
      const normalize = getNormalizeMultiplier(followersCount);

      const orderPointsEarned = saree.length * 10 * normalize;
      const premiumPointsEarned = getPremiumPoints(followersCount);
      const consistencyPointsEarned =
        (leaderboard?.consistencyPoints || 0) + 5;

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
        leaderboard.consistencyPoints = consistencyPointsEarned;
      }

      leaderboard.totalPoints =
        leaderboard.orderPoints +
        leaderboard.premiumPoints +
        leaderboard.consistencyPoints;

      await leaderboard.save({ session });
    }

    /* ---------- COMMIT ---------- */
    await session.commitTransaction();

    return res.status(200).json({
      message: "Purchase + Leaderboard update successful",
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(error);

    return res.status(500).json({
      message: "Transaction failed. No data saved.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};