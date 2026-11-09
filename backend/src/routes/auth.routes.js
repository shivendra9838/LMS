const express = require('express');
const router = express.Router();
const { login, getMe, logout } = require('../controllers/auth.controller');
const { validateLogin } = require('../validators/auth.validator');
const { authenticate } = require('../middlewares/auth.middleware');

const {rateLimit}=require('express-rate-limit');
const loginLimit=rateLimit({windowMs:15*60000,limit:15,skipSuccessfulRequests:true,standardHeaders:'draft-8',legacyHeaders:false,message:{success:false,message:'Too many sign-in attempts. Try again in 15 minutes.'}});
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.post('/login', loginLimit, validateLogin, login);
for(const [path,role] of [['admin','ADMIN'],['employee','EMPLOYEE']]){
 router.post('/'+path+'/login',loginLimit,(req,res,next)=>{req.loginRole=role;next();},validateLogin,login);
}
router.use('/admin',require('./passwordRecovery.routes').forRole('ADMIN'));
router.use('/employee', require('./passwordRecovery.routes'));
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

module.exports = router;
