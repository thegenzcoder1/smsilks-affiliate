// controllers/promoCode.controller.js
const PromoCode = require("../models/PromoCode");
const mongoose = require("mongoose");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /promoCode
 * Body: { promoCode }
 */
exports.createPromoCode = async (req, res) => {
  try {
    let { promoCode } = req.body;

    if (!promoCode) {
      return res.status(400).json({
        message: "promoCode is required",
      });
    }

    promoCode = promoCode.toUpperCase().trim();

    const existing = await PromoCode.findOne({ promoCode });

    if (existing) {
      return res.status(409).json({
        message: "Promo code already exists",
      });
    }

    const promo = await PromoCode.create({
      promoCode,
      details: [], // empty initially
    });

    return res.status(201).json({
      message: "Promo code created successfully",
      promo,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /promoCode/email
 * Body: { promoCode, email, discountPercentage }
 */


// Initialize Resend


exports.addEmailToPromoCode = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let { promoCode, email, discountPercentage } = req.body;

    if (!promoCode || !email || discountPercentage === undefined) {
      return res.status(400).json({
        message: "promoCode, email and discountPercentage are required",
      });
    }

    promoCode = promoCode.toUpperCase().trim();
    email = email.toLowerCase().trim();

    session.startTransaction();

    const promo = await PromoCode.findOne(
      { promoCode },
      null,
      { session }
    );

    if (!promo) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Promo code does not exist. Cannot add email.",
      });
    }

    const existingDetail = promo.details.find(
      (d) => d.email === email
    );

    if (existingDetail) {
      await session.abortTransaction();
      return res.status(409).json({
        message: `Email ${email} already exists for promoCode ${promoCode}`,
      });
    }

    // 1️⃣ Add email + discount (NOT committed yet)
    promo.details.push({
      email,
      discountPercentage      
    });

    await promo.save({ session });

    // 2️⃣ SEND EMAIL (CRITICAL STEP)
    await resend.emails.send({
      from: "affiliate-noreply@kancheepuramsmsilks.net",
      to: email,
      subject: `Your Promo Code For This Campaign - ${promoCode}`,
      html: `
        <h3>Love All. Serve All.</h3>
        <p>You have been added To The New affiliate. Below Are The PromoCode Details...</p>
        <p><b>Promo Code:</b> ${promoCode}</p>
        <p><b>Your Discount:</b> ${discountPercentage}%</p>
        <hr></hr>
        <p>You will receive notifications whenever a sale happens.</p>
        <p>Thanks And Regards,</p>
        <p>Kancheepuram SM Silks</p>
      `,
    });

    // 3️⃣ EMAIL SUCCESS → COMMIT
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Email added to promo code and notification sent successfully",
      promo,
    });

  } catch (error) {
    // ❌ Any failure → rollback
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      message: "Failed to add affiliate email",
      error: error.message,
    });
  }
};

/**
 * PUT /promoCode/email
 * Body: { promoCode, email, discountPercentage }
 */
exports.updatePromoCode = async (req, res) => {
  try {
    let { promoCode, email, discountPercentage } = req.body;

    if (!promoCode || !email || discountPercentage === undefined) {
      return res.status(400).json({
        message: "promoCode, email and discountPercentage are required",
      });
    }

    promoCode = promoCode.toUpperCase().trim();
    email = email.toLowerCase().trim();

    const promo = await PromoCode.findOne({ promoCode });

    if (!promo) {
      return res.status(404).json({
        message: "Promo code does not exist. Cannot update.",
      });
    }

    const existingDetail = promo.details.find(
      (d) => d.email === email
    );

    if (!existingDetail) {
      return res.status(404).json({
        message: `Email ${email} does not exist for promoCode ${promoCode}`,
      });
    }

    existingDetail.discountPercentage = discountPercentage;

    await promo.save();

    return res.json({
      message: "Promo code updated successfully",
      promo,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /promoCode
 * Body: { promoCode }
 */
exports.deletePromoCode = async (req, res) => {
  try {
    let { promoCode } = req.body;

    if (!promoCode) {
      return res.status(400).json({
        message: "promoCode is required",
      });
    }

    promoCode = promoCode.toUpperCase().trim();

    const deleted = await PromoCode.findOneAndDelete({ promoCode });

    if (!deleted) {
      return res.status(404).json({ message: "Promo code not found" });
    }

    return res.json({
      message: "Promo code deleted successfully",
      deleted,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /promoCodes
 * Returns all promoCodes with details array
 */
exports.getAllPromoCodes = async (req, res) => {
  try {
    let { offset = 0, limit = 10 } = req.query;

    offset = parseInt(offset, 10);
    limit = parseInt(limit, 10);

    // Safety checks
    if (offset < 0) offset = 0;
    if (limit <= 0) limit = 10;
    if (limit > 100) limit = 100; // prevent abuse

    const [promos, totalCount] = await Promise.all([
      PromoCode.find({})
        .select("-_id promoCode details")
        .skip(offset)
        .limit(limit)
        .lean(),

      PromoCode.countDocuments(),
    ]);

    return res.json({
      data: promos,
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: offset + promos.length < totalCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


exports.getSinglePromoCode = async (req, res) => {
  try {
    let { promoCode } = req.params;

    if (!promoCode) {
      return res.status(400).json({
        message: "promoCode is required",
      });
    }

    promoCode = promoCode.trim();

    const promo = await PromoCode.find({
      promoCode: {
        $regex: promoCode,
        $options: "i", // case-insensitive LIKE
      },
    })
      .select("-_id promoCode details")
      .lean();

    if (!promo) {
      return res.status(404).json({
        message: "Promo code not found",
      });
    }

    return res.status(200).json(promo);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};


/**
 * DELETE /promoCode/email
 * Body: { promoCode, email }
 */
exports.deleteEmailFromPromoCode = async (req, res) => {
  try {
    let { promoCode, email } = req.body;

    if (!promoCode || !email) {
      return res.status(400).json({
        message: "promoCode and email are required",
      });
    }

    promoCode = promoCode.toUpperCase().trim();
    email = email.toLowerCase().trim();

    // 1️⃣ Find promo code
    const promo = await PromoCode.findOne({ promoCode });

    if (!promo) {
      return res.status(404).json({
        message: "Promo code not found",
      });
    }

    // 2️⃣ Find the email entry
    const removedDetail = promo.details.find(
      (d) => d.email === email
    );

    if (!removedDetail) {
      return res.status(404).json({
        message: "Email not found for this promo code",
      });
    }

    // 3️⃣ Remove the email
    promo.details = promo.details.filter(
      (d) => d.email !== email
    );

    await promo.save();

    // 4️⃣ Return promoCode + removed email + discount
    return res.status(200).json({
      message: "Email removed from promo code successfully",
      promoCode,
      removed: {
        email: removedDetail.email,
        discountPercentage: removedDetail.discountPercentage,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
