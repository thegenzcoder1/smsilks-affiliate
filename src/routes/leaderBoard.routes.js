const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const {
  login,
  createUser,
  updateUserPassword,
  deleteUser
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

router.get(
  "/leaderboard/admin/users",
  adminMiddleware,
  getUsersForAdmin
);

router.get(
  "/leaderboard/user/purchases",
  authMiddleware,
  getAffiliatePurchaseHistory
);

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

router.patch("/leaderboard/admin/user/:instagramUsername/password", adminMiddleware, updateUserPassword);


router.delete("/leaderboard/user/:instagramUsername", adminMiddleware, deleteUser);






module.exports = router;
