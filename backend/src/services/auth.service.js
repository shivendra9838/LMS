const { findUserByEmail } = require('../repositories/auth.repository');
const { comparePassword, hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
let dummyHash;
const invalid=()=>Object.assign(new Error('Invalid email or password for this portal.'),{status:401});
const loginService = async (email, password, expectedRole) => {
  if(expectedRole&&!['ADMIN','EMPLOYEE'].includes(expectedRole))throw invalid();
  const user=await findUserByEmail(email,expectedRole);
  if(!user)dummyHash ||= hashPassword(require('crypto').randomBytes(32).toString('hex'));
  const matches=await comparePassword(password,user?.password||await dummyHash);
  // Route-selected role and database identity are authoritative, never body.role.
  if(!user||!matches||!['ADMIN','EMPLOYEE'].includes(user.role)||(expectedRole&&user.role!==expectedRole)||user.isActive===false||user.status==='INACTIVE')throw invalid();
  return {token:generateToken(user._id,user.role,user.authVersion||0),user:{id:user._id,name:user.name,role:user.role}};
};
module.exports={loginService};
