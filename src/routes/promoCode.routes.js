// routes/promoCode.routes.js
const router = require("express").Router();
const promoController = require("../controllers/promoCode.controller.js");

router.post("/promoCode", promoController.createPromoCode);
router.put("/promoCode/discount", promoController.updatePromoCode);
router.delete("/promoCode", promoController.deletePromoCode);
router.get("/promoCodes", promoController.getAllPromoCodes);
 router.get("/promoCode/search/:promoCode", promoController.getSinglePromoCode);
router.delete("/promoCode/email",promoController.deleteEmailFromPromoCode);
router.post("/promoCode/email", promoController.addEmailToPromoCode);

module.exports = router;
