const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    instaUsername: { // customer
      type: String,
      required: true,
    },
    affiliateInstagramUsername: {
      type: String,
      required: true,
    },
    instaUserPhone: {
      type: String,
      required: true,
    },
    sareeBought: Number,
    totalBill: Number,
    emailMessageSent: Boolean,
  },
  { _id: false }
);


const instagramPurchaseSchema = new mongoose.Schema({
  promoCode: {
    type: String,
    required: true,
    unique: true, // Primary Key
  },
  purchases: {
    type: [purchaseSchema],
    validate: {
      validator: function (arr) {
        const usernames = arr.map(p => p.instaUsername);
        return usernames.length === new Set(usernames).size;
      },
      message: "Duplicate Instagram username for same promo code",
    },
  },
});

module.exports = mongoose.model(
  "InstagramPurchase",
  instagramPurchaseSchema
);