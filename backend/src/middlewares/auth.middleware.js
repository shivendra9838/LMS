const { verifyToken } = require('../utils/jwt');

const authenticate = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized', errors: [] });
    }
    
    const decoded = verifyToken(token);
    if (!['ADMIN','EMPLOYEE'].includes(decoded.role)) return res.status(401).json({success:false,message:'Unauthorized',errors:[]});
    if (decoded.role === 'EMPLOYEE') {
      const employee = await require('../models/Employee').findById(decoded.id).select('status +authVersion');
      if (employee && employee.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, message: 'Employee account is inactive', errors: [] });
      }
      if (!employee || (employee.authVersion || 0) !== (decoded.authVersion || 0)) {
        return res.status(401).json({ success: false, message: 'Please sign in again', errors: [] });
      }
    }
    if (decoded.role === 'ADMIN') {
      const admin = await require('../models/Admin').findById(decoded.id).select('isActive +authVersion');
      if(admin&&!admin.isActive)return res.status(403).json({success:false,message:'Admin account is inactive',errors:[]});
      if (!admin || (admin.authVersion || 0) !== (decoded.authVersion || 0)) {
        return res.status(401).json({success:false,message:'Please sign in again',errors:[]});
      }
    }
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized', errors: [] });
  }
};

module.exports = { authenticate };
