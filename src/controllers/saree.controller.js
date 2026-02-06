// controllers/saree.controller.js
const Saree = require("../models/Saree");

/* =====================================================
   GET /search/sareeId?ref=501&offset=0&limit=10
   LIKE search on sareeId with pagination
===================================================== */
/**
 * GET /search/sareeId
 * Query: ?ref=501&offset=0&limit=10
 */
// GET /search/sareeId?ref=5012
exports.searchBySareeId = async (req, res) => {
  try {
    const { ref } = req.query;

    if (!ref) {
      return res.status(400).json({
        message: "ref (sareeId) is required",
      });
    }

    // ✅ Exact match only
    const saree = await Saree.findOne({
      sareeId: ref,
    })
      .select("-_id sareeId sareeName")
      .lean();

    if (!saree) {
      return res.status(404).json({
        message: "Saree not found",
      });
    }

    return res.status(200).json({
      data: saree,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to search saree by ID",
      error: error.message,
    });
  }
};




/**
 * GET /search/sareeName
 * Query: ?ref=silk&offset=0&limit=10
 */
exports.searchBySareeName = async (req, res) => {
  try {
    let { ref, offset = 0, limit = 10 } = req.query;

    if (!ref) {
      return res.status(400).json({
        message: "ref (sareeName) is required",
      });
    }

    offset = parseInt(offset, 10);
    limit = parseInt(limit, 10);

    if (offset < 0) offset = 0;
    if (limit <= 0) limit = 10;
    if (limit > 100) limit = 100;

    const filter = {
      sareeName: {
        $regex: `^${ref}`, // ✅ STARTS WITH
      },
    };

    const [sarees, totalCount] = await Promise.all([
      Saree.find(filter)
        .select("-_id sareeId sareeName")
        .skip(offset)
        .limit(limit)
        .lean(),

      Saree.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: sarees,
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: offset + sarees.length < totalCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to search saree by name",
      error: error.message,
    });
  }
};



/* =====================================================
   DELETE /saree
   Body: { sareeId }
===================================================== */
exports.deleteSaree = async (req, res) => {
  try {
    let { sareeId } = req.body;

    if (!sareeId) {
      return res.status(400).json({
        message: "sareeId is required",
      });
    }

    const deleted = await Saree.findOneAndDelete({
      sareeId,
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Saree not found",
      });
    }

    return res.status(200).json({
      message: "Saree deleted successfully",
      sareeId: deleted.sareeId,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete saree",
      error: error.message,
    });
  }
};



/**
 * GET /sarees
 * Query: ?offset=0&limit=10
 */
exports.getAllSarees = async (req, res) => {
  try {
    let { offset = 0, limit = 10 } = req.query;

    offset = parseInt(offset, 10);
    limit = parseInt(limit, 10);

    // Safety guards
    if (offset < 0) offset = 0;
    if (limit <= 0) limit = 10;
    if (limit > 100) limit = 100;

    const [sarees, totalCount] = await Promise.all([
      Saree.find({})
        .select("-_id sareeId sareeName")
        .skip(offset)
        .limit(limit)
        .lean(),

      Saree.countDocuments(),
    ]);

    return res.status(200).json({
      data: sarees,
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: offset + sarees.length < totalCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch sarees",
      error: error.message,
    });
  }
};
