// Local acceptance verifier. No deletion/reset operations; never prints secrets or customer values.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });
const output = path.join(__dirname, '../../tmp/phase1-local-verification');
fs.mkdirSync(output, { recursive: true });
const file = name => path.join(output, name);
const mode = process.argv[2] || 'baseline';
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

(async () => {
  const keyValid = /^[a-f0-9]{64}$/i.test(process.env.KYC_ENCRYPTION_KEY || '');
  let cryptoRoundTrip = false;
  if (keyValid) {
    const { encrypt, decrypt } = require('../src/utils/kycCrypto');
    const probe = Buffer.from('local-acceptance-probe');
    cryptoRoundTrip = decrypt(encrypt(probe)).equals(probe);
  }
  console.log(JSON.stringify({ persistentEncryptionKeyPresent: keyValid, cryptoRoundTrip }));
  if (!process.env.MONGODB_URI) throw new Error('MongoDB URI is not configured');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  console.log(JSON.stringify({ configuredDatabaseConnected: true, transactionCapable: Boolean(hello.setName || hello.msg === 'isdbgrid') }));
  if (mode === 'baseline') {
    const snapshot = { keyDigest: digest(process.env.KYC_ENCRYPTION_KEY), collections: {} };
    for (const name of ['customers', 'loans', 'collections']) {
      const records = {};
      for await (const row of mongoose.connection.db.collection(name).find({}).sort({ _id: 1 })) records[String(row._id)] = digest(row);
      snapshot.collections[name] = records;
      console.log(JSON.stringify({ collection: name, baselineCount: Object.keys(records).length }));
    }
    fs.writeFileSync(file('baseline.json'), JSON.stringify(snapshot, null, 2));
  } else if (mode === 'accounts') {
    if (fs.existsSync(file('accounts.json'))) throw new Error('Verification accounts already recorded; existing records were not changed');
    const Admin = require('../src/models/Admin');
    const Employee = require('../src/models/Employee');
    const { generateEmployeeCode } = require('../src/utils/generateCode');
    const stamp = Date.now().toString(36);
    const password = crypto.randomBytes(18).toString('base64url');
    const admin = await Admin.create({ name: 'PHASE1 VERIFICATION ONLY Admin', email: `phase1-admin-${stamp}@verification.invalid`, password, phone: '9000000001' });
    const employee = await Employee.create({ name: 'PHASE1 VERIFICATION ONLY Employee', employeeCode: await generateEmployeeCode(), email: `phase1-employee-${stamp}@verification.invalid`, password, phone: '9000000002', city: 'Verification City', area: 'Verification Area', createdBy: admin._id });
    fs.writeFileSync(file('accounts.json'), JSON.stringify({ admin: { id: String(admin._id), email: admin.email }, employee: { id: String(employee._id), email: employee.email }, password }));
    console.log('Created and retained two labeled verification-only accounts; credentials stored only in ignored local QA file.');
  } else if (mode === 'compare') {
    const baseline = JSON.parse(fs.readFileSync(file('baseline.json')));
    const result = { encryptionKeyUnchanged: baseline.keyDigest === digest(process.env.KYC_ENCRYPTION_KEY), collections: {} };
    for (const [name, records] of Object.entries(baseline.collections)) {
      let unchanged = 0, changed = 0, missing = 0;
      for (const [id, hash] of Object.entries(records)) {
        const row = await mongoose.connection.db.collection(name).findOne({ _id: new mongoose.Types.ObjectId(id) });
        if (!row) missing++; else if (digest(row) === hash) unchanged++; else changed++;
      }
      result.collections[name] = { originalCount: Object.keys(records).length, unchanged, changed, missing, currentCount: await mongoose.connection.db.collection(name).countDocuments() };
    }
    fs.writeFileSync(file('comparison.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
  await mongoose.disconnect();
})().catch(async error => {
  console.error(JSON.stringify({ verificationFailed: true, errorType: error.name, code: error.code || null }));
  await mongoose.disconnect(); process.exitCode = 1;
});
