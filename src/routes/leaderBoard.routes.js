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
  adminDeleteLeaderboardUser,
  getUsersForAdmin,
  getAffiliatePurchaseHistory
} = require("../controllers/leaderboard.controller");

/* -------- AUTH -------- */
router.post("/leaderboard/login", login);
router.post("/leaderboard/admin/create", adminMiddleware, createUser);

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

router.delete(
  "/leaderboard/admin/:instagramUsername",
  adminMiddleware,
  adminDeleteLeaderboardUser
);

router.get(
  "/leaderboard/admin/:instagramUsername",
  adminMiddleware,
  getUsersForAdmin
)

router.get(
  "/leaderboard/user/purchases",
  authMiddleware,
  getAffiliatePurchaseHistory
);


module.exports = router;
