// models/PromoCode.js
const mongoose = require("mongoose");

const promoDetailSchema = new mongoose.Schema(
  {
    affiliateInstagramUsername: {
      type: String,
      required: true,
      trim: true,
    },    
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Invalid email format",
      ],
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const promoCodeSchema = new mongoose.Schema({
  promoCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  details: {
    type: [promoDetailSchema],
    default: [],
    validate: [
      {
        // ✅ unique email per promoCode
        validator: function (arr) {
          const emails = arr.map(d => d.email);
          return emails.length === new Set(emails).size;
        },
        message: "Duplicate email not allowed for the same promoCode",
      },
      {
        // ✅ unique email per promoCode
        validator: function (arr) {
          const affiliateInstagramUsername = arr.map(d => d.affiliateInstagramUsername);
          return affiliateInstagramUsername.length === new Set(affiliateInstagramUsername).size;
        },
        message: "Duplicate Affiliate Instagram Username not allowed for the same promoCode",
      },
    ],
  },
});

module.exports = mongoose.model("PromoCode", promoCodeSchema);
