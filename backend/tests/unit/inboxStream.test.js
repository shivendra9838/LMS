const mongoose = require('mongoose');
const inbox = require('../../src/services/inbox.service');

test('a stream cancelled during authentication does not reserve a connection slot', async () => {
  jest.useFakeTimers();
  const req = { user: { id: String(new mongoose.Types.ObjectId()), role: 'EMPLOYEE' }, headers: { authorization: 'Bearer synthetic-invalid-token' } };
  const res = { destroyed: true, writableEnded: false, status: jest.fn(), set: jest.fn(), flushHeaders: jest.fn(), write: jest.fn(), end: jest.fn(), on: jest.fn() };
  res.status.mockReturnValue(res); res.set.mockReturnValue(res);
  try {
    await inbox.stream(req, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.flushHeaders).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.clearAllTimers(); jest.useRealTimers(); }
});
