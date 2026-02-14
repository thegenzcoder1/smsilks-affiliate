const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const LeaderboardUser = require("../models/LeaderboardUser");
const { signToken } = require("../utils/jwt");
const Leaderboard = require("../models/LeaderBoard");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

//Send Welcome Email For This
async function sendWelcomeEmail(to, instagramUsername, password) {
  await resend.emails.send({
    from: "affiliate-noreply@kancheepuramsmsilks.net",
    to,
    subject: "Welcome to the Kancheepuram SM Silks Leaderboard 🎉",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        
        <h2 style="color:#8B0000;">Welcome to the Kancheepuram SM Silks Leaderboard</h2>
        
        <p>
          As discussed earlier, the Leaderboard has been created to encourage all our
          business partners to grow together as a community.
        </p>

        <p>
          The leaderboard ranking is calculated based on three point categories:
        </p>

        <ul>
          <li><strong>Order Points</strong></li>
          <li><strong>Premium Points</strong></li>
          <li><strong>Consistency Points</strong></li>
        </ul>

        <p>
          The system is designed in a fair way so that every partner has an equal opportunity 
          to reach the top.
        </p>

        <hr />

        <h3>🔐 Login Details</h3>

        <p><strong>Login URL:</strong> 
          <a href="https://leaderboard.kancheepuramsmsilks.net">
            https://leaderboard.kancheepuramsmsilks.net
          </a>
        </p>

        <p><strong>Username:</strong> ${instagramUsername}</p>
        <p><strong>Password:</strong> ${password}</p>

        <hr />

        <h3>📊 Steps to Update Followers Count</h3>

        <ol>
          <li>Login to your dashboard.</li>
          <li>Click on <strong>Profile</strong> at the top.</li>
          <li>Update your <strong>Followers Count</strong> in the textbox.</li>
          <li>Click <strong>Submit Followers</strong>.</li>
          <li>Our team will verify and update your followers count accordingly.</li>
        </ol>

        <hr />

        <p>
          For any clarification or explanation regarding the points system,
          please contact us at:
        </p>

        <p><strong>📞 +91 9585983635</strong></p>

        <br/>

        <p>Thanks & Regards,</p>
        <p><strong>Kancheepuram S.M. Silks</strong></p>

      </div>
    `,
  });
}


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
  const session = await mongoose.startSession();

  try {
    const { instagramUser, password, email } = req.body;

    /* ---------- VALIDATION ---------- */
    if (!instagramUser || !password || !email) {
      return res.status(400).json({
        message: "instagramUser, email and password are required",
      });
    }

    const normalizedUsername = instagramUser.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    session.startTransaction();

    /* ---------- CHECK DUPLICATES ---------- */
    const existingUsername = await LeaderboardUser.findOne(
      { instagramUsername: normalizedUsername },
      null,
      { session }
    );

    if (existingUsername) {
      await session.abortTransaction();
      return res.status(409).json({
        message: "Instagram username already exists",
      });
    }

    const existingEmail = await LeaderboardUser.findOne(
      { email: normalizedEmail },
      null,
      { session }
    );

    if (existingEmail) {
      await session.abortTransaction();
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    /* ---------- HASH PASSWORD ---------- */
    const passwordHash = await bcrypt.hash(password, 10);

    /* ---------- CREATE LEADERBOARD USER ---------- */
    await LeaderboardUser.create(
      [
        {
          instagramUsername: normalizedUsername,
          passwordHash,
          email: normalizedEmail,
        },
      ],
      { session }
    );

    /* ---------- CREATE LEADERBOARD ENTRY ---------- */
    await Leaderboard.create(
      [
        {
          instagramUsername: normalizedUsername,
          email: normalizedEmail,
          followersCount: 0,
          orderPoints: 0,
          premiumPoints: 0,
          consistencyPoints: 0,
          totalPoints: 0,
        },
      ],
      { session }
    );

    /* ---------- SEND WELCOME EMAIL (CRITICAL) ---------- */
    await sendWelcomeEmail(
      normalizedEmail,
      normalizedUsername,
      password
    );

    /* ---------- COMMIT ---------- */
    await session.commitTransaction();

    return res.status(201).json({
      message: "Leaderboard user created successfully",
      instagramUsername: normalizedUsername,
      email: normalizedEmail,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(error);

    return res.status(500).json({
      message: "User creation failed",
      error: error.message,
    });

  } finally {
    session.endSession();
  }
};

exports.updateUserPassword = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { instagramUsername } = req.params;
    const { newPassword } = req.body;

    if (!instagramUsername || !newPassword) {
      return res.status(400).json({
        message: "instagramUsername and newPassword are required",
      });
    }

    const normalizedUsername = instagramUsername.toLowerCase().trim();

    session.startTransaction();

    const user = await LeaderboardUser.findOne(
      { instagramUsername: normalizedUsername },
      null,
      { session }
    );

    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "User not found",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    user.passwordHash = passwordHash;

    await user.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      message: "Password updated successfully",
      instagramUsername: normalizedUsername,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(error);

    return res.status(500).json({
      message: "Password update failed",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};


exports.deleteUser = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { instagramUsername } = req.params;

    if (!instagramUsername) {
      return res.status(400).json({
        message: "instagramUsername is required",
      });
    }

    const normalizedUsername = instagramUsername.toLowerCase().trim();

    session.startTransaction();

    /* ---------- DELETE FROM LEADERBOARD USER ---------- */
    const deletedUser = await LeaderboardUser.findOneAndDelete(
      { instagramUsername: normalizedUsername },
      { session }
    );

    if (!deletedUser) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "User not found in LeaderboardUser",
      });
    }

    /* ---------- DELETE FROM LEADERBOARD ---------- */
    await Leaderboard.findOneAndDelete(
      { instagramUsername: normalizedUsername },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      message: "User deleted successfully from LeaderboardUser and Leaderboard",
      instagramUsername: normalizedUsername,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(error);

    return res.status(500).json({
      message: "User deletion failed",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
