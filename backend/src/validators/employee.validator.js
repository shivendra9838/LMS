const validateCreateEmployee = (req, res, next) => {
  const { name, email, phone, city, area, branchId } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
  if (!phone) return res.status(400).json({ success: false, message: 'Phone is required' });
  if (!city && !branchId) return res.status(400).json({ success: false, message: 'City or branchId is required' });
  if (!area) return res.status(400).json({ success: false, message: 'Area is required' });
  next();
};

module.exports = { validateCreateEmployee };
