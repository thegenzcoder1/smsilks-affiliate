const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const {
  login,
  createUser,
} = require("../controllers/leaderboard.auth.controller");

const {
  getUsers,
  getUserByUsername,
  requestFollowersUpdate,
  adminUpdateFollowers,
} = require("../controllers/leaderboard.controller");

/* -------- AUTH -------- */
router.post("/leaderboard/login", login);
router.post("/leaderboard/create", adminMiddleware, createUser);

/* -------- LEADERBOARD -------- */
router.get("/leaderboard/users", authMiddleware, getUsers);
router.get("/leaderboard/user", authMiddleware, getUserByUsername);
router.patch(
  "/leaderboard/user/:instagramUsername",
  authMiddleware,
  requestFollowersUpdate
);
router.patch(
  "/leaderboard/admin/:instagramUsername",  
  adminMiddleware,
  adminUpdateFollowers
);

module.exports = router;
