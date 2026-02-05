const router = require("express").Router();
const { createUser, getUsers } = require("../controllers/user.controller");

router.post("/", createUser);
router.get("/", getUsers);

module.exports = router;
