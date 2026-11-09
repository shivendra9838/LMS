const sections = require('../config/kycFields.json');
const fields = sections.flatMap(section => section.fields);
const fail = (message, errors = []) => { throw Object.assign(new Error(message), { status: 422, errors }); };
function validateKyc(input, complete = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('KYC data must be an object');
  const data = {};
  const errors = [];
  const add = (path, msg) => errors.push({ path, msg });
  for (const [name, label, type, required] of fields) {
    const raw = input[name];
    if (raw !== undefined && typeof raw !== 'string' && typeof raw !== 'number') { add(name, `${label} must be text`); continue; }
    const value = String(raw ?? '').trim();
    data[name] = value;
    const max = type === 'textarea' ? 500 : 120;
    if (value.length > max) add(name, `${label} must be at most ${max} characters`);
    if (complete && required && !value) add(name, `${label} is required`);
    if (!value) continue;
    if (type === 'tel' && !/^[6-9]\d{9}$/.test(value)) add(name, `${label} must be a valid 10-digit Indian mobile number`);
    if (type === 'pin' && !/^[1-9]\d{5}$/.test(value)) add(name, `${label} must be a valid 6-digit PIN`);
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) add(name, 'Enter a valid email address');
    if (type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) add(name, `${label} must be a valid date`);
    if (type === 'number' && (!(name === 'tenure' ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(value) || Number(value) <= 0 || Number(value) > (name === 'tenure' ? 3650 : 100000000))) add(name, `${label} is outside the supported range`);
    if (type === 'account' && !/^\d{9,18}$/.test(value)) add(name, 'Account number must have 9 to 18 digits');
  }
  if (data.gender && !['Male', 'Female', 'Other'].includes(data.gender)) add('gender', 'Select a valid gender');
  if (data.maritalStatus && !['Single', 'Married', 'Divorced', 'Widowed', 'Other'].includes(data.maritalStatus)) add('maritalStatus', 'Select a valid marital status');
  if (data.idProofType && !['Aadhar', 'PAN', 'VoterID', 'DrivingLicense', 'Passport'].includes(data.idProofType)) add('idProofType', 'Select a valid ID proof');
  if (data.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifsc)) add('ifsc', 'Enter a valid 11-character IFSC code');
  if (data.idProofNumber && data.idProofType === 'Aadhar' && !/^[2-9]\d{11}$/.test(data.idProofNumber)) add('idProofNumber', 'Aadhaar must have 12 digits');
  if (data.idProofNumber && data.idProofType === 'PAN' && !/^[A-Z]{5}\d{4}[A-Z]$/.test(data.idProofNumber)) add('idProofNumber', 'Enter a valid PAN');
  if (data.dob && Number.isFinite(Date.parse(data.dob))) {
    const dob = new Date(data.dob);
    const now = new Date();
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age--;
    if (age < 19 || age > 110) add('dob', 'Customer must be between 19 and 110 years old');
  }
  if (data.declarationDate && new Date(data.declarationDate) > new Date()) add('declarationDate', 'Declaration date cannot be in the future');
  if (input.declarationAccepted !== undefined && typeof input.declarationAccepted !== 'boolean') add('declarationAccepted', 'Declaration must be true or false');
  data.declarationAccepted = input.declarationAccepted === true;
  if (complete && !data.declarationAccepted) add('declarationAccepted', 'Customer declaration must be accepted');
  if (errors.length) fail('Please correct the highlighted KYC fields', errors);
  return data;
}
module.exports = { validateKyc };
