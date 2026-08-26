const router = require("express").Router();
const Sale = require("../models/sale");
const Product = require("../models/product");
const auth = require("../middleware/auth");

// WAT = UTC+1. Returns { start, end } as UTC Date objects covering the full
// current day in West Africa Time, so queries on MongoDB (which stores UTC)
// correctly capture all sales that happened "today" in Lagos/Abuja.
function watTodayBounds() {
  const WAT_OFFSET_MS = 60 * 60 * 1000; // UTC+1
  const nowUTC = Date.now();
  const nowWAT = new Date(nowUTC + WAT_OFFSET_MS);
  // Midnight WAT in UTC = subtract the time-of-day portion then subtract the offset back
  const midnightWAT_asUTC = new Date(
    nowUTC
    + WAT_OFFSET_MS
    - (nowWAT.getUTCHours() * 3600000
       + nowWAT.getUTCMinutes() * 60000
       + nowWAT.getUTCSeconds() * 1000
       + nowWAT.getUTCMilliseconds())
    - WAT_OFFSET_MS
  );
  return {
    start: midnightWAT_asUTC,
    end: new Date(midnightWAT_asUTC.getTime() + 24 * 60 * 60 * 1000 - 1)
  };
}

// Parse a YYYY-MM-DD string as WAT (UTC+1) start-of-day, returned as UTC Date.
function watDateStart(dateStr) {
  return new Date(new Date(dateStr).getTime() - 60 * 60 * 1000);
}

// Parse a YYYY-MM-DD string as WAT end-of-day, returned as UTC Date.
function watDateEnd(dateStr) {
  return new Date(new Date(dateStr).getTime() - 60 * 60 * 1000 + 24 * 60 * 60 * 1000 - 1);
}

// Create sale + deduct stock
router.post("/", auth, async (req, res) => {
  try {
    // Debug log incoming sale POST (shortened body for safety)
    try {
      const shortBody = JSON.stringify(req.body).slice(0, 2000);
      console.log("[DEBUG] POST /api/sales from:", req.user && req.user.username ? req.user.username : '(unknown)', "body:", shortBody);
    } catch (e) {
      console.warn("[DEBUG] Failed to stringify sale body:", e && e.message ? e.message : e);
    }

    const { items, total, offlineId, date } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }
    if (!total || total <= 0) {
      return res.status(400).json({ message: "Valid total amount is required" });
    }

    // Duplicate check — return existing sale if offlineId already exists
    if (offlineId) {
      const existing = await Sale.findOne({ offlineId });
      if (existing) {
        return res.json(existing);
      }
    }

    let profit = 0;

    // Deduct stock
    for (const item of items) {
      const product = await Product.findById(item._id);
      if (!product) {
        return res.status(404).json({
          message: `Product ${item._id} not found`
        });
      }
      if (product.stock < item.qty) {
        return res.status(400).json({
          message: `${product.name} has insufficient stock (available: ${product.stock}, requested: ${item.qty})`
        });
      }
      product.stock -= item.qty;
      profit += (product.price - (product.costPrice || 0)) * item.qty;
      await product.save();
    }

    const margin = total > 0 ? ((profit / total) * 100).toFixed(2) : 0;

    // Ensure date is valid (use current date if not provided or invalid)
    let saleDate = new Date();
    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        saleDate = parsedDate;
      }
    }

    // Save sale
    const sale = new Sale({ 
      items, 
      total: parseFloat(total), 
      profit: parseFloat(profit.toFixed(2)), 
      offlineId: offlineId || null, 
      cashier: req.user && req.user.username ? req.user.username : "cashier",
      date: saleDate 
    });
    await sale.save();

    res.json({ message: "Sale completed", sale, margin: `${margin}%` });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📊 Get daily sales summary
router.get("/report", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  try {
    const { start, end } = req.query;

    const match = {};

    if (start && end) {
      // Treat YYYY-MM-DD strings as WAT (UTC+1) day boundaries, not UTC
      const startDate = /^\d{4}-\d{2}-\d{2}$/.test(start) ? watDateStart(start) : new Date(start);
      const endDate   = /^\d{4}-\d{2}-\d{2}$/.test(end)   ? watDateEnd(end)     : new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      match.date = { $gte: startDate, $lte: endDate };
    }

    const report = await Sale.aggregate([
      { $match: match },
      {
        // Convert UTC date to WAT (UTC+1) before grouping by day
        $addFields: {
          localDate: {
            $dateAdd: { startDate: "$date", unit: "hour", amount: 1 }
          }
        }
      },
      {
        $group: {
          _id: {
            day:   { $dayOfMonth: "$localDate" },
            month: { $month:      "$localDate" },
            year:  { $year:       "$localDate" }
          },
          totalSales:  { $sum: "$total" },
          totalProfit: { $sum: "$profit" },
          count:       { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📈 Today's performance
router.get("/today-performance", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }

  try {
    const { start, end } = watTodayBounds();

    const sales = await Sale.find({
      date: {
        $gte: start,
        $lte: end
      }
    });

    const transactionsToday = sales.length;
    const revenueToday = sales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
    const profitToday = sales.reduce((sum, sale) => sum + (parseFloat(sale.profit) || 0), 0);
    const profitMargin = revenueToday > 0 ? ((profitToday / revenueToday) * 100).toFixed(2) : "0.00";

    res.json({
      transactionsToday,
      revenueToday: parseFloat(revenueToday.toFixed(2)),
      profitToday: parseFloat(profitToday.toFixed(2)),
      profitMargin: parseFloat(profitMargin)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete today's sales — admin only
router.delete("/today", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admins only" });
  try {
    const { start, end } = watTodayBounds();
    const result = await Sale.deleteMany({ date: { $gte: start, $lte: end } });
    res.json({ message: `Cleared ${result.deletedCount} sales for today` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🧾 Get all sales
router.get("/", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  try {
    const sales = await Sale.find().sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🧾 Get recent individual sales with full item breakdown (admin only)
router.get("/recent", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // Optional date range filter
    const filter = {};
    if (req.query.start || req.query.end) {
      filter.date = {};
      if (req.query.start) {
        filter.date.$gte = /^\d{4}-\d{2}-\d{2}$/.test(req.query.start)
          ? watDateStart(req.query.start) : new Date(req.query.start);
      }
      if (req.query.end) {
        filter.date.$lte = /^\d{4}-\d{2}-\d{2}$/.test(req.query.end)
          ? watDateEnd(req.query.end) : new Date(req.query.end);
      }
    }

    const [sales, total] = await Promise.all([
      Sale.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      Sale.countDocuments(filter)
    ]);

    res.json({ sales, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ Void a sale and restore stock — admin only
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admins only" });
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    // Restore stock for each item
    for (const item of sale.items) {
      const product = await Product.findById(item._id);
      if (!product) {
        console.warn(`[Void] Product ${item._id} no longer exists — skipping stock restore`);
        continue;
      }
      product.stock += item.qty;
      await product.save();
    }

    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: "Sale voided and stock restored" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
