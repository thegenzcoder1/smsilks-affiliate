const express = require("express");
const app = express();

/* ================================
   GLOBAL CORS + SECURITY MIDDLEWARE
================================ */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const token = req.headers["token"];

  const allowedOrigins = [
    "https://kancheepuramsmsilks.net",
    "https://affiliatestore.kancheepuramsmsilks.net",
    "https://admin5143.kancheepuramsmsilks.net",
  ];

  /* =========================================
     1️⃣ ALWAYS SET CORS HEADERS FIRST
  ========================================= */

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ||
      "Content-Type, Authorization, token",
  );

  /* =========================================
     2️⃣ HANDLE PREFLIGHT (MUST BE AFTER HEADERS)
  ========================================= */

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  /* =========================================
     3️⃣ TOKEN BASED ACCESS (Postman / Admin / Server)
  ========================================= */

  if (token && token === process.env.POSTMAN_ACCESS_KEY) {
    return next();
  }

  /* =========================================
     4️⃣ BROWSER ORIGIN CHECK
  ========================================= */

  let isAllowed = false;

  if (origin) {
    isAllowed =
      allowedOrigins.includes(origin) ||
      origin.endsWith(".kancheepuramsmsilks.net");
  }

  if (!isAllowed) {
    return res.status(403).json({
      message: "CORS: Origin not allowed",
    });
  }

  next();
});

app.use(express.json());

/* ================================
   ROUTES
================================ */

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api", require("./routes/promoCode.routes"));
app.use("/api", require("./routes/whatsapp.routes"));
app.use("/api", require("./routes/saree.routes"));
app.use("/api", require("./routes/leaderBoard.routes"));

module.exports = app;
