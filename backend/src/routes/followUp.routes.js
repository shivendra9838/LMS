const router=require('express').Router();
const {authenticate}=require('../middlewares/auth.middleware'),service=require('../services/followUp.service');
router.use(authenticate);const run=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
router.get('/',run(req=>service.list(req.user,req.query)));
router.get('/:loanId/history',run(req=>service.history(req.params.loanId,req.user,req.query)));
router.post('/:loanId',run(req=>service.create(req.params.loanId,req.body,req.user)));
module.exports=router;
