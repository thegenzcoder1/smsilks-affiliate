const express = require("express");
const cors = require("cors");

const app = express();

/* ================================
   CORS CONFIGURATION
================================ */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman, curl)
    // if (!origin) return callback(null, true);
    if(!origin) {
      return callback(
      new Error("Not allowed by CORS"),
      false
    );
    }

    // Allow all subdomains of kancheepuramsmsilks.com
    if (origin.endsWith(".kancheepuramsmsilks.com")) {
      return callback(null, true);
    }

    // Reject others
    return callback(
      new Error("Not allowed by CORS"),
      false
    );
  },
  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],
  allowedHeaders: "*",
  credentials: true,
};

/* ================================
   MIDDLEWARES
================================ */
// app.use(cors(corsOptions));
// app.options("*", cors(corsOptions)); // handle preflight

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const secret_access_key = req.headers.secret_access_key;

  const allowedOrigins = [
    "https://kancheepuramsmsilks.net",
  ];

  let isAllowed = false;

  /* =========================
     CASE 1: Browser request
  ========================== */
  if (origin) {
    isAllowed =
      allowedOrigins.includes(origin) ||
      origin.endsWith(".kancheepuramsmsilks.net");
  }

  /* =========================
     CASE 2: Server-to-server
     (nginx / curl / healthcheck)
  ========================== */
  if ((secret_access_key === process.env.POSTMAN_ACCESS_KEY)) {
    isAllowed = true;
  }

  /* =========================
     SET HEADERS (safe)
  ========================== */
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, secret_access_key"
  );

  /* =========================
     PREFLIGHT
  ========================== */
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  /* =========================
     FINAL CHECK
  ========================== */
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

module.exports = app;