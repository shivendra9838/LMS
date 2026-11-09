function forRole(role){
const router = require('express').Router();
const { body } = require('express-validator');
const { rateLimit } = require('express-rate-limit');
const validate = require('../middlewares/validate.middleware');
const recovery = require('../services/passwordRecovery.service');
const { logError } = require('../utils/logger');

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const limiter = rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Too many recovery attempts. Please try again in 15 minutes.' } });
router.use(limiter);

router.post('/otp/request',body('email').isString().trim().isLength({max:254}).isEmail().toLowerCase(),body('role').optional().isIn(['ADMIN','EMPLOYEE']),validate,(req,res)=>{
  if(!recovery.emailConfiguration())return res.status(503).json({success:false,message:'Email is not configured. Contact Admin.'});
  const challenge=require('crypto').randomBytes(24).toString('hex');
  setImmediate(()=>require('../services/email.service').requestCode(req.body.email,role,'RESET',undefined,challenge).catch(()=>logError('OTP_DELIVERY_FAILED',new Error('Account recovery delivery failed'))));
  res.status(202).json({success:true,data:{challenge},message:'If an active account matches, a code will arrive shortly. Check spam. The code expires in 10 minutes.'});
});
router.post('/otp/reset',async(req,res,next)=>{try{await require('../services/email.service').confirmCode(req.body,undefined,role);res.json({success:true,message:'Password updated. Sign in with your new password.'});}catch(error){next(error);}});

if(role==='ADMIN')return router;

router.post('/forgot-password', body('email').isString().trim().isLength({ max: 254 }).isEmail().toLowerCase(), validate, (req, res) => {
  const emailConfig=recovery.emailConfiguration();
  if (!emailConfig) return res.status(503).json({ success: false, message: 'Password recovery email is not configured. Please contact your administrator.' });
  if (!require('../services/emailTemplate.service').publicActionUrl(emailConfig.origin+'/employee/reset-password')) return res.status(503).json({ success: false, message: 'Password reset links require a public HTTPS portal URL. Use the email OTP reset option or contact your administrator.' });
  // Return identically for unknown, inactive and eligible accounts, without delivery timing revealing account existence.
  setImmediate(() => recovery.requestReset(req.body.email, req).catch(() => {
    logError('PASSWORD_RECOVERY_DELIVERY_FAILED', new Error('Password recovery email could not be delivered; check Gmail configuration.'));
  }));
  return res.status(202).json({ success: true, message: 'If an active employee account matches this email, a reset link will arrive shortly. Check your spam folder too.' });
});

router.post('/reset-password', body('token').custom(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))
    .withMessage('This reset link is invalid. Please request a new link.').hide(),
  body('password').custom(value => typeof value === 'string' && value.length >= 12 && value.length <= 64 && Buffer.byteLength(value, 'utf8') <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value))
    .withMessage('Use 12–64 characters with uppercase, lowercase, a number and a symbol').hide(),
  body('confirmPassword').custom((value, { req }) => typeof value === 'string' && value === req.body.password).withMessage('Passwords do not match').hide(), validate,
  async (req, res, next) => {
    try {
      const changed = await recovery.completeReset(req.body.token, req.body.password, req);
      if (!changed) return res.status(400).json({ success: false, message: 'This reset link is invalid, expired or already used. Please request a new link.' });
      return res.json({ success: true, message: 'Password updated. Please sign in with your new password.' });
    } catch (error) { next(error); }
  });

return router;
}
const router=forRole('EMPLOYEE');router.forRole=forRole;module.exports=router;
