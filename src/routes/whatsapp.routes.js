// routes/whatsapp.routes.js
const router = require("express").Router();
const whatsappController = require("../controllers/whatsapp.controller");
const adminMiddleware = require("../middleware/adminMiddleware");

router.post("/complete-purchase", whatsappController.sendEmailNotification);
router.get("/admin/purchases/:promoCode", adminMiddleware, whatsappController.getPurchasesByPromoCode);
router.delete("/admin/purchases", adminMiddleware, whatsappController.deletePurchaseByUsername);


module.exports = router;
