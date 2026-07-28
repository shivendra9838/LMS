const { loginService } = require('../services/auth.service');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginService(email, password);
    
    res.status(200).json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (error) {
    if (error.message === 'User Not Found' || error.message === 'Invalid Credentials') {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

const Admin = require('../models/Admin');
const Employee = require('../models/Employee');

const getMe = async (req, res, next) => {
  try {
    let user;
    if (req.user.role === 'ADMIN') {
      user = await Admin.findById(req.user.id).select('-password');
    } else {
      user = await Employee.findById(req.user.id).select('-password');
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: {
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, getMe };
