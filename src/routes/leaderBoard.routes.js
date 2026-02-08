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
router.post("/login", login);
router.post("/create", adminMiddleware, createUser);

/* -------- LEADERBOARD -------- */
router.get("/users", authMiddleware, getUsers);
router.get("/user/:instagramUsername", authMiddleware, getUserByUsername);
router.patch(
  "/user/:instagramUsername",
  authMiddleware,
  requestFollowersUpdate
);
router.patch(
  "/admin/:instagramUsername",
  authMiddleware,
  adminMiddleware,
  adminUpdateFollowers
);

module.exports = router;
