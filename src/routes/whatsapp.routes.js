// routes/whatsapp.routes.js
const router = require("express").Router();
const whatsappController = require("../controllers/whatsapp.controller");

router.post("/send-whatsapp", whatsappController.sendEmailNotification);

module.exports = router;
