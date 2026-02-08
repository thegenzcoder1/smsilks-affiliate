module.exports = (req, res, next) => {
  const adminToken = req.headers["admin-token"];

  if (!adminToken) {
    return res.status(403).json({
      message: "Admin token missing",
    });
  }

  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({
      message: "Invalid admin token",
    });
  }

  next();
};
