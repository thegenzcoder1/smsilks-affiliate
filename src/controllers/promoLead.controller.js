const PromoCode = require("../models/PromoCode");
const PromoCodeLead = require("../models/PromoCodeLead");

/* =====================================
   CREATE LEAD
   POST /api/promo-lead
===================================== */
exports.createPromoLead = async (req, res) => {
  try {
    let { promoCode, instagramUsername, fullName, phoneNumber, email } =
      req.body;

    if (
      !promoCode ||
      !instagramUsername ||
      !fullName ||
      !phoneNumber ||
      !email
    ) {
      return res.status(400).json({
        message:
          "promoCode, instagramUsername, fullName, phoneNumber and email are required",
      });
    }

    promoCode = promoCode.toUpperCase().trim();
    instagramUsername = instagramUsername.toLowerCase().trim();
    fullName = fullName.trim();
    phoneNumber = phoneNumber.trim();
    email = email.toLowerCase().trim();

    /* Validate phone */
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        message: "Phone number must be exactly 10 digits",
      });
    }

    /* Validate email */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    /* Check promo exists */
    const promo = await PromoCode.findOne({ promoCode }).lean();

    if (!promo) {
      return res.status(404).json({
        message: "Invalid PromoCode",
      });
    }

    const lead = await PromoCodeLead.create({
      promoCode,
      instagramUsername,
      fullName,
      phoneNumber,
      email,
    });

    return res.status(201).json({
      message: "Promo lead created successfully",
      lead,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "You have already registered with this username or email for this promoCode",
      });
    }

    return res.status(500).json({
      message: "Failed to create promo lead",
      error: error.message,
    });
  }
};

/* =====================================
   GET LEADS BY PROMOCODE
   GET /api/promo-lead/:promoCode
===================================== */
exports.getLeadsByPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.params;

    if (!promoCode) {
      return res.status(400).json({
        message: "promoCode is required",
      });
    }

    const leads = await PromoCodeLead.find({
      promoCode: promoCode.toUpperCase().trim(),
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      data: leads,
      count: leads.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch leads",
      error: error.message,
    });
  }
};

exports.getUnconvertedLeadsByPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.params;

    if (!promoCode) {
      return res.status(400).json({
        message: "promoCode is required",
      });
    }

    const normalizedPromoCode = promoCode.toUpperCase().trim();

    const leads = await PromoCodeLead.find({
      promoCode: normalizedPromoCode,
      isConverted: false, // 🔥 Only unconverted leads
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      data: leads,
      count: leads.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch unconverted leads",
      error: error.message,
    });
  }
};
