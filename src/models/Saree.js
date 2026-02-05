// models/Saree.js
const mongoose = require("mongoose");

const sareeSchema = new mongoose.Schema({
  sareeId: {
    type: String,
    required: true,
    unique: true, // Primary Key
  },
  sareeName: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Saree", sareeSchema);
