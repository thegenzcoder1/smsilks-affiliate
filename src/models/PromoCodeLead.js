const mongoose = require("mongoose");

const promoCodeLeadSchema = new mongoose.Schema(
  {
    promoCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    instagramUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^[0-9]{10}$/.test(v);
        },
        message: "Phone number must be exactly 10 digits",
      },
    },

    isConverted: {
      type: Boolean,
      default: false,
    },

    convertedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

/* Prevent duplicate lead for same promoCode + username */
promoCodeLeadSchema.index(
  { promoCode: 1, instagramUsername: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "PromoCodeLead",
  promoCodeLeadSchema
);
