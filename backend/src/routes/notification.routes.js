const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { getAdminNotifications } = require('../controllers/notification.controller');

const inbox=require('../services/inbox.service');
const run=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
router.use('/inbox',authenticate,authorizeRoles('ADMIN','EMPLOYEE'),(req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/inbox/count',run(async(req,res)=>res.json({success:true,data:{unread:await require('../models/UserNotification').countDocuments({recipientId:req.user.id,role:req.user.role,dismissedAt:null,readAt:null})}})));
router.get('/inbox',run(async(req,res)=>res.json({success:true,data:await inbox.list(req.user,req.query)})));
router.post('/inbox/:id/open',run(async(req,res)=>res.json({success:true,data:await inbox.open(req.user,req.params.id,req.body?.target)})));
router.post('/inbox/:id/dismiss',run(async(req,res)=>res.json({success:true,data:await inbox.dismiss(req.user,req.params.id)})));
router.post('/inbox/:id/restore',run(async(req,res)=>res.json({success:true,data:await inbox.dismiss(req.user,req.params.id,true)})));
router.patch('/inbox/:id',run(async(req,res)=>res.json({success:true,data:await inbox.mark(req.user,req.params.id,req.body?.unread)})));
router.post('/inbox/read-all',run(async(req,res)=>{await require('../models/UserNotification').updateMany({recipientId:req.user.id,role:req.user.role,dismissedAt:null,readAt:null},{$set:{readAt:new Date()}});res.json({success:true,data:{updated:true}});}));
router.get('/stream',authenticate,authorizeRoles('ADMIN','EMPLOYEE'),run(inbox.stream));
// GET /api/notifications
router.get('/', authenticate, authorizeRoles('ADMIN'), getAdminNotifications);

module.exports = router;
