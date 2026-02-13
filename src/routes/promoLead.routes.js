const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");

const {
  createPromoLead,
  getLeadsByPromoCode,  
  getUnconvertedLeadsByPromoCode  
} = require("../controllers/promoLead.controller.js");

//GET Unconverted Lead For PromoCode
router.get(
  "/leads/:promoCode/unconverted",
  adminMiddleware,
  getUnconvertedLeadsByPromoCode
);

// Public form submission
router.post("/promo-lead", createPromoLead);

// Admin view leads
router.get("/promo-lead/:promoCode", adminMiddleware, getLeadsByPromoCode);

// Admin mark converted
// router.patch("/promo-lead/:id/convert", adminMiddleware, markLeadConverted);

module.exports = router;