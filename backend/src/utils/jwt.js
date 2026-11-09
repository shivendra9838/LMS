const jwt = require('jsonwebtoken');

const generateToken = (id, role, authVersion = 0) => {
  return jwt.sign(
    { id, role, authVersion },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
