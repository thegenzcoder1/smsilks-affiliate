const jwt = require("jsonwebtoken");

exports.signToken = (instagramUsername) => {
  return jwt.sign(
    { instagramUsername },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

exports.verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
