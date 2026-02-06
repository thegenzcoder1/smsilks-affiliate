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

    /* ---------- BASIC VALIDATION ---------- */
    if (
      !promoCode ||
      !instagramUsername ||
      !instagramUserPhone ||
      !Array.isArray(saree) ||
      saree.length === 0 ||
      !totalBill
    ) {
      return res.status(400).json({
        message:
          "Missing required fields. promoCode, instagramUsername, instagramUserPhone, saree[], totalBill are required.",
      });
    }

    promoCode = promoCode.toUpperCase().trim();
    instagramUsername = instagramUsername.trim();

    /* ---------- PROMO VALIDATION ---------- */
    const promo = await PromoCode.findOne({ promoCode }).lean();
    if (!promo) {
      return res.status(404).json({ message: "PromoCode Not Found" });
    }

    const affiliates = promo.details.map(d => ({
      email: d.email,
      discountPercentage: d.discountPercentage,
    }));

    if (affiliates.length === 0) {
      return res.status(404).json({
        message: "No Affiliate Email Present For This Coupon Code",
      });
    }

    // 1️⃣ Validate saree array before mapping
    const hasInvalidSareeId = saree.some(
      (s) => !s.sareeId || s.sareeId.trim() === ""
    );

    if (hasInvalidSareeId) {
      return res.status(400).json({
        message: "sareeId should be present for all sarees",
      });
    }

    /* ---------- IDEMPOTENCY ---------- */
    const sareeIds = saree.map(s => s.sareeId);

    const existingSarees = await Saree.find({
      sareeId: { $in: sareeIds },
    }).lean();

    if (existingSarees.length > 0) {
      return res.status(409).json({
        message: `${existingSarees.map(s => s.sareeId).join(", ")} Already Exists.`,
      });
    }

    const existingPurchase = await InstagramPurchase.findOne({
      promoCode,
      "purchases.instaUsername": instagramUsername,
    }).lean();

    if (existingPurchase) {
      return res.status(409).json({
        message: `username: ${instagramUsername} can use this promo code only once. For additional purchases, please ask a different individual with their own Instagram account to comment and claim the offer.`,
      });
    }

    const sareeNames = saree.map(s => s.sareeName).join(", ");
    const sareeBoughtCount = saree.length;

    /* ---------- TRANSACTION START ---------- */
    session.startTransaction();

    // 1️⃣ Insert Sarees
    await Saree.insertMany(
      saree.map(s => ({
        sareeId: s.sareeId,
        sareeName: s.sareeName,
      })),
      { session }
    );

    // 2️⃣ Insert Purchase (tentative)
    let purchaseDoc = await InstagramPurchase.findOne(
      { promoCode },
      null,
      { session }
    );

    const newPurchase = {
      instaUsername: instagramUsername,
      instaUserPhone: instagramUserPhone,
      sareeBought: sareeBoughtCount,
      totalBill,
      emailMessageSent: true, // optimistic
    };

    if (!purchaseDoc) {
      purchaseDoc = new InstagramPurchase({
        promoCode,
        purchases: [newPurchase],
      });
    } else {
      purchaseDoc.purchases.push(newPurchase);
    }

    await purchaseDoc.save({ session });

    // 3️⃣ Send Emails (CRITICAL)
    for (const affiliate of affiliates) {
      const affiliateAmount = Math.round(
        totalBill * (affiliate.discountPercentage / 100)
      );

      const payload = {
        instaUsername: instagramUsername,
        instaUserPhone: instagramUserPhone,
        sareeBought: sareeBoughtCount,
        sareeNames,
        billAmount: totalBill,
        discountPercentage: affiliate.discountPercentage,
        affiliateAmount,
      };

      const sent = await sendEmailWithRetry(
        affiliate.email,
        promoCode,
        payload,
        3
      );

      if (!sent) {
        throw new Error(`Email failed for ${affiliate.email}`);
      }
    }

    // 4️⃣ All success → COMMIT
    await session.commitTransaction();

    return res.status(200).json({
      message: "Email notification process successful",
      promoCode,
      purchase: newPurchase,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(error);

    return res.status(500).json({
      message: "Transaction failed. No data was saved.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
