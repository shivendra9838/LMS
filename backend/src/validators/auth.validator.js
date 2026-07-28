const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }
  
  next();
};

module.exports = { validateLogin };
