// routes/whatsapp.routes.js
const router = require("express").Router();
const sareeController = require("../controllers/saree.controller");

router.get("/search/sareeId", sareeController.searchBySareeId);
router.get("/search/sareeName", sareeController.searchBySareeName);
router.delete("/saree", sareeController.deleteSaree);
router.get('/sarees', sareeController.getAllSarees);

module.exports = router;
