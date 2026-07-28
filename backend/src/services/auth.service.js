const { findUserByEmail } = require('../repositories/auth.repository');
const { comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

const loginService = async (email, password) => {
  const user = await findUserByEmail(email);
  
  if (!user) {
    const error = new Error('User Not Found');
    error.status = 404;
    throw error;
  }

  const isMatch = await comparePassword(password, user.password);
  
  if (!isMatch) {
    const error = new Error('Invalid Credentials');
    error.status = 401;
    throw error;
  }

  const token = generateToken(user._id, user.role);
  
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      role: user.role
    }
  };
};

module.exports = { loginService };
