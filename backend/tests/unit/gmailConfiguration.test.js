const {emailConfiguration}=require('../../src/services/passwordRecovery.service');
const original={...process.env};
beforeEach(()=>{process.env={...original,GMAIL_USER:'sender@gmail.com',GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop',FRONTEND_URL:'https://portal.example.test'};});
afterEach(()=>{process.env=original;});
test('Gmail needs only sender and app password, strips Google display spaces and derives From',()=>{
 const config=emailConfiguration();
 expect(config.from).toBe('Royal Enterprises <sender@gmail.com>');
 expect(config.transport).toMatchObject({service:'gmail',requireTLS:true,auth:{user:'sender@gmail.com',pass:'abcdefghijklmnop'}});
 expect(config.transport.host).toBeUndefined();expect(config.transport.port).toBeUndefined();
});
test('legacy SMTP settings cannot redirect or override Gmail credentials',()=>{
 Object.assign(process.env,{SMTP_HOST:'untrusted.invalid',SMTP_PORT:'25',SMTP_USER:'other@example.test',SMTP_PASS:'other',SMTP_FROM:'Other <other@example.test>'});
 expect(emailConfiguration().transport.service).toBe('gmail');
 expect(emailConfiguration().from).toBe('Royal Enterprises <sender@gmail.com>');
 delete process.env.GMAIL_APP_PASSWORD;expect(emailConfiguration()).toBeNull();
});
test.each(['','normal-password','abcd1234ijklmnop'])('invalid app password is rejected (%s)',password=>{
 process.env.GMAIL_APP_PASSWORD=password;expect(emailConfiguration()).toBeNull();
});
test('sender header injection and untrusted portal origin are rejected',()=>{
 process.env.GMAIL_USER='sender@gmail.com\r\nBcc:other@example.test';expect(emailConfiguration()).toBeNull();
 process.env.GMAIL_USER='sender@gmail.com';process.env.FRONTEND_URL='http://public.example.test';expect(emailConfiguration()).toBeNull();
});
