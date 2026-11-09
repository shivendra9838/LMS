const {minor,legacyMinor,major}=require('../../src/utils/money');
describe('Integer-paise financial calculations',()=>{
 test('adds small decimal amounts exactly',()=>{expect(major(minor('0.10')+minor('0.20'))).toBe(0.3);expect(minor('250.25')).toBe(25025);expect(legacyMinor(0.1+0.2)).toBe(30);});
 test.each(['-1','0','0.001','1e3','NaN','Infinity',' 2 ','999999999999999999','1.234'])('rejects unsupported monetary input %s',value=>expect(()=>minor(value)).toThrow());
 test('permits explicit zero only for observed discrepancies',()=>{expect(minor('0',true)).toBe(0);});
});
