const { loginService } = require('../services/auth.service');
const { createAuditLog } = require('../utils/auditLogger');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginService(email, password);
    
    // Attach user to req for auditLogger helper
    req.user = { id: result.user._id, role: result.user.role };
    createAuditLog(req, {
      action: `${result.user.role}_LOGIN`,
      module: 'AUTH',
      referenceId: result.user._id,
      newValue: { email: result.user.email, role: result.user.role }
    });

    res.status(200).json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (error) {
    if (error.message === 'User Not Found' || error.message === 'Invalid Credentials' || error.message === 'Employee account is inactive') {
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

const logout = (req, res) => {
  // Since JWT is stateless, logout is handled by the client destroying the token.
  // This endpoint is provided for consistency and future-proofing (e.g. cookie clearing).
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

module.exports = { login, getMe, logout };
