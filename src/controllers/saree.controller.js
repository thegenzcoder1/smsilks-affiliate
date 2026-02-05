// controllers/saree.controller.js
const Saree = require("../models/Saree");

/**
 * POST /saree
 * Body: { sareeId, sareeName }
 */
exports.deleteSarees = async (req, res) => {
  try {
    const { sarees } = req.body; // Expecting an array of objects: [{ sareeId: "S1" }, { sareeId: "S2" }]

    if (!sarees || !Array.isArray(sarees) || sarees.length === 0) {
      return res.status(400).json({
        message: "An array of sarees with sareeId is required.",
      });
    }

    // Extract only the sareeId values into a simple array
    const idsToDelete = sarees.map((s) => s.sareeId);

    // Delete all sarees where the sareeId is present in our list
    const result = await Saree.deleteMany({
      sareeId: { $in: idsToDelete },
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "No sarees found with the provided IDs.",
      });
    }

    res.status(200).json({
      message: "Sarees deleted successfully",
      deletedCount: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};