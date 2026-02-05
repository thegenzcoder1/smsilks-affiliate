const router = require("express").Router();
const healthController = require("../controllers/health.controller");
const contactController = require("../controllers/contact.controller");

router.get("/health", healthController.healthCheck);

// Contact Endpoint
router.post("/contact", contactController.submitContactForm);

module.exports = router;
