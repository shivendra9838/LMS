const mongoose=require('mongoose'),request=require('supertest'),jwt=require('jsonwebtoken');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('nodemailer',()=>({createTransport:jest.fn()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
const Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),app=require('../../src/app');
const {generateToken}=require('../../src/utils/jwt');
let mongo,admin,employee,adminToken,employeeToken,originalPasswordHash,lastMail;
const password='IsolatedPortal123!';
const login=(role,email,pw=password,extra={})=>request(app).post('/api/v1/auth/'+role+'/login').send({email,password:pw,...extra});
const get=(path,token)=>request(app).get('/api/v1'+path).set('Authorization','Bearer '+token);
jest.setTimeout(120000);
beforeAll(async()=>{
 Object.assign(process.env,{JWT_SECRET:'portal-login-isolated-secret',SMTP_HOST:'smtp.gmail.com',SMTP_PORT:'465',SMTP_USER:'sandbox@example.test',SMTP_PASS:'synthetic-only',SMTP_FROM:'Royal <sandbox@example.test>',FRONTEND_URL:'http://localhost:5173'});
 require('nodemailer').createTransport.mockReturnValue({sendMail:async mail=>{lastMail=mail;return {accepted:[mail.to]};},close:jest.fn()});
 mongo=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(mongo.getUri(),{dbName:'isolated_portal_login'});
 await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
 admin=await Admin.create({name:'Synthetic Admin',email:'admin@portal.test',password,phone:'9000000000'});
 employee=await Employee.create({name:'Synthetic Employee',employeeCode:'EMP-PORTAL',email:'employee@portal.test',password,phone:'9000000001',city:'Test',area:'QA',createdBy:admin._id});
 originalPasswordHash=(await Employee.findById(employee._id)).password;
 adminToken=generateToken(admin._id,'ADMIN');employeeToken=generateToken(employee._id,'EMPLOYEE');
});
afterAll(async()=>{await mongoose.disconnect();if(mongo)await mongo.stop();});
test.each([['admin','ADMIN'],['employee','EMPLOYEE']])('%s portal authenticates its database role and marks responses private',async(path,role)=>{
 const account=role==='ADMIN'?admin:employee,res=await login(path,account.email);expect(res.status).toBe(200);expect(res.headers['cache-control']).toBe('no-store');expect(res.body.data.user.role).toBe(role);expect(jwt.verify(res.body.data.token,process.env.JWT_SECRET).role).toBe(role);
});
test('wrong portal, wrong password, unknown and inactive users all fail generically without issuing a token',async()=>{
 const failures=[await login('admin',employee.email),await login('employee',admin.email),await login('employee',employee.email,'WrongPassword123!'),await login('employee','missing@portal.test')];
 await Employee.updateOne({_id:employee._id},{$set:{status:'INACTIVE'}});failures.push(await login('employee',employee.email));await Employee.updateOne({_id:employee._id},{$set:{status:'ACTIVE'}});
 for(const res of failures){expect(res.status).toBe(401);expect(res.body.message).toBe('Invalid email or password for this portal.');expect(res.body.data?.token).toBeUndefined();expect(res.body.token).toBeUndefined();}
});
test('request-supplied roles cannot elevate an employee or cross-authenticate an administrator',async()=>{
 const own=await login('employee',employee.email,password,{role:'ADMIN'});expect(own.status).toBe(200);expect(own.body.data.user.role).toBe('EMPLOYEE');expect((await login('employee',admin.email,password,{role:'ADMIN'})).status).toBe(401);
});
test('same email in both collections is resolved by the server-selected portal, without Admin shadowing Employee',async()=>{
 const second=await Employee.create({name:'Synthetic Shared Address',employeeCode:'EMP-SHARED',email:admin.email,password,phone:'9000000002',city:'Test',area:'QA',createdBy:admin._id});
 expect((await login('employee',admin.email)).body.data.user.id).toBe(String(second._id));expect((await login('admin',admin.email)).body.data.user.id).toBe(String(admin._id));
});
test('actual protected APIs enforce both roles and preserve legitimate Admin employee management',async()=>{
 expect((await get('/employees',employeeToken)).status).toBe(403);expect((await get('/admin/dashboard',employeeToken)).status).toBe(403);expect((await get('/settings/email-operations',employeeToken)).status).toBe(403);
 expect((await get('/employees/profile',adminToken)).status).toBe(403);expect((await get('/employees',adminToken)).status).toBe(200);expect((await get('/employees/profile',employeeToken)).status).toBe(200);
});
test('expired, forged and unsupported-role tokens are rejected by actual protected endpoints',async()=>{
 const expired=jwt.sign({id:String(employee._id),role:'EMPLOYEE'},process.env.JWT_SECRET,{expiresIn:-1});
 const forged=jwt.sign({id:String(admin._id),role:'ADMIN'},'wrong-key');
 const unsupported=jwt.sign({id:String(admin._id),role:'SUPERUSER'},process.env.JWT_SECRET);
 for(const token of [expired,forged,unsupported,'invalid'])expect((await get('/auth/me',token)).status).toBe(401);
});
test('portal attempts do not modify existing credentials/roles or invalidate unrelated existing tokens',async()=>{
 expect((await get('/auth/me',employeeToken)).status).toBe(200);expect((await get('/auth/me',adminToken)).status).toBe(200);const saved=await Employee.findById(employee._id);expect(saved.password).toBe(originalPasswordHash);expect(saved.role).toBe('EMPLOYEE');
 expect(await require('../../src/models/Loan').countDocuments()).toBe(0);expect(await require('../../src/models/Collection').countDocuments()).toBe(0);
});
test('OTP endpoints bind role server-side; an Admin challenge cannot reset through Employee recovery',async()=>{
 const service=require('../../src/services/email.service');const challenge=await service.requestCode(admin.email,'ADMIN');const code=lastMail.text.match(/code is (\d{6})/)[1];
 const body={challenge,code,password:'ReplacementPortal123!',confirmPassword:'ReplacementPortal123!'};
 expect((await request(app).post('/api/v1/auth/employee/otp/reset').send(body)).status).toBe(422);
 expect((await request(app).post('/api/v1/auth/admin/otp/reset').send(body)).status).toBe(200);
 expect((await login('admin',admin.email,'ReplacementPortal123!')).status).toBe(200);expect((await get('/auth/me',adminToken)).status).toBe(401);
 const known=await request(app).post('/api/v1/auth/admin/otp/request').send({email:admin.email,role:'EMPLOYEE'}),unknown=await request(app).post('/api/v1/auth/admin/otp/request').send({email:'absent@portal.test'});expect(known.status).toBe(202);expect(unknown.status).toBe(202);expect(known.body.message).toBe(unknown.body.message);expect(known.body.data).not.toHaveProperty('code');
});
test('invalid password validation never echoes submitted passwords',async()=>{
 const secret='x'.repeat(1001),res=await login('employee',employee.email,secret);expect(res.status).toBe(400);expect(JSON.stringify(res.body)).not.toContain(secret);
});
test('failed sign-ins are rate-limited across portal routes',async()=>{
 let blocked=false;for(let n=0;n<16;n++){const result=await login(n%2?'admin':'employee','absent@portal.test');if(result.status===429){blocked=true;break;}}expect(blocked).toBe(true);
});
