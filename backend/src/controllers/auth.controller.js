const { loginService } = require('../services/auth.service');
const { createAuditLog } = require('../utils/auditLogger');
const { logAccess } = require('../utils/logger');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginService(email, password, req.loginRole);
    
    // Attach user to req for auditLogger helper
    req.user = { id: result.user.id, role: result.user.role };
    createAuditLog(req, {
      action: `${result.user.role}_LOGIN`,
      module: 'AUTH',
      referenceId: result.user.id,
      newValue: { email, role: result.user.role }
    });
    logAccess('USER_LOGIN', {
      userId: result.user.id,
      userRole: result.user.role,
      email,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (error) {
    if(error.status===401){logAccess('FAILED_LOGIN',{portal:req.loginRole||'LEGACY',ipAddress:req.ip});return res.status(401).json({success:false,message:'Invalid email or password for this portal.'});}
    if (error.message === 'User Not Found' || error.message === 'Invalid Credentials' || error.message === 'Employee account is inactive') {
      logAccess('FAILED_LOGIN', {
        email: req.body?.email,
        reason: error.message,
        ipAddress: req.ip
      });
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
