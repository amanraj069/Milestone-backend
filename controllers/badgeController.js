const Badge = require('../models/Badge');

exports.createBadge = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.title || !payload.skillName || !payload.criteria) return res.status(400).json({ success: false, error: { message: 'Missing required fields' } });
    const b = new Badge(payload);
    await b.save();
    res.json({ success: true, data: b });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

exports.listBadges = async (req, res) => {
  try {
    const badges = await Badge.find().sort({ createdAt: -1 });
    res.json({ success: true, data: badges });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};
