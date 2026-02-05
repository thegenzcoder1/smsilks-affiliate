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

  // ✅ Allow non-browser requests
  if (!origin) {
    return next();
  }

  const allowedOrigins = [
    "http://localhost:5173",
    "https://kancheepuramsmsilks.net",
  ];

  const isAllowed =
    allowedOrigins.includes(origin) ||
    origin.endsWith(".kancheepuramsmsilks.net");

  // ✅ ALWAYS set headers first
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // ✅ Handle preflight IMMEDIATELY
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  // ❌ Reject AFTER headers are set
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

module.exports = app;