const bcrypt = require("bcrypt");
const LeaderboardUser = require("../models/LeaderboardUser");
const { signToken } = require("../utils/jwt");

/* ==============================
   POST /leaderboard/login
   Returns JWT
================================ */
exports.login = async (req, res) => {
  try {
    const { instagramUser, password } = req.body;

    if (!instagramUser || !password) {
      return res.status(400).json({
        message: "instagramUser and password are required",
      });
    }

    const user = await LeaderboardUser.findOne({
      instagramUsername: instagramUser.toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid Username. Contact +91-9585983635 To Change Them",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid Password. Contact +91-9585983635 To Change Them.",
      });
    }

    const token = signToken(user.instagramUsername);

    return res.status(200).json({
      token,
      message: "Login Successful"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Login failed",
    });
  }
};

/* ==============================
   POST /leaderboard/create
   Admin-only user creation
   NO JWT RETURNED
================================ */
exports.createUser = async (req, res) => {
  try {
    const { instagramUser, password } = req.body;

    if (!instagramUser || !password) {
      return res.status(400).json({
        message: "instagramUser and password are required",
      });
    }

    const existing = await LeaderboardUser.findOne({
      instagramUsername: instagramUser.toLowerCase(),
    });

    if (existing) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await LeaderboardUser.create({
      instagramUsername: instagramUser.toLowerCase(),
      passwordHash,
    });

    return res.status(201).json({
      message: "Leaderboard user created successfully",
      instagramUsername: instagramUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "User creation failed",
    });
  }
};
