const request = require('supertest');
const { generateToken } = require('../../src/utils/jwt');
jest.mock('../../src/models/Admin',()=>({findById:jest.fn(()=>({select:jest.fn().mockResolvedValue({isActive:true,authVersion:0})}))}));

jest.mock('../../src/services/auth.service', () => ({
  loginService: jest.fn()
}));

jest.mock('../../src/services/customer.service', () => ({
  createCustomerService: jest.fn(),
  getCustomerListService: jest.fn(),
  getCustomerByIdService: jest.fn(),
  updateCustomerService: jest.fn(),
  updateCustomerStatusService: jest.fn(),
  getCustomerTimelineService: jest.fn()
}));

jest.mock('../../src/services/loan.service', () => ({
  createLoanService: jest.fn(),
  getLoanListService: jest.fn(),
  getLoanByIdService: jest.fn(),
  updateLoanStatusService: jest.fn()
}));

jest.mock('../../src/services/collection.service', () => ({
  getTodayCollectionService: jest.fn(),
  recordCollectionService: jest.fn(),
  getCollectionHistoryService: jest.fn(),
  getCollectionReceiptService: jest.fn()
}));

jest.mock('../../src/services/report.service', () => ({
  getDailyReportsService: jest.fn(),
  getEmployeeReportsService: jest.fn(),
  getAreaReportsService: jest.fn(),
  getOutstandingReportsService: jest.fn(),
  getCollectionReportsService: jest.fn(),
  getExportDataService: jest.fn()
}));

jest.mock('../../src/utils/excelExport', () => ({
  exportToExcel: jest.fn((res, data, sheetName, filename) => {
    return res.status(200).json({
      success: true,
      message: 'Report exported successfully',
      data: { sheetName, filename, rows: data.length }
    });
  })
}));

jest.mock('../../src/utils/auditLogger', () => ({
  createAuditLog: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  logAccess: jest.fn(),
  logError: jest.fn(),
  accessLoggerMiddleware: (req, res, next) => next()
}));

jest.mock('../../src/utils/cache', () => ({
  redisClient: { quit: jest.fn() },
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(undefined),
  invalidateCache: jest.fn().mockResolvedValue(undefined)
}));

const { loginService } = require('../../src/services/auth.service');
const { createCustomerService } = require('../../src/services/customer.service');
const { createLoanService } = require('../../src/services/loan.service');
const { recordCollectionService } = require('../../src/services/collection.service');
const { getExportDataService } = require('../../src/services/report.service');
const app = require('../../src/app');

describe('API Integration Tests', () => {
  let adminToken;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    adminToken = generateToken('507f1f77bcf86cd799439011', 'ADMIN');
  });

  test('Login returns token and user', async () => {
    loginService.mockResolvedValue({
      token: 'token-123',
      user: { id: '507f1f77bcf86cd799439011', name: 'Admin', role: 'ADMIN' }
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Secret123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('token-123');
  });

  test('Create Customer validates and calls service', async () => {
    createCustomerService.mockResolvedValue({
      _id: '507f1f77bcf86cd799439012',
      customerCode: 'CUS000001',
      name: 'Customer One'
    });

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Customer One',
        fatherName: 'Father',
        mobile: '9876543210',
        age: 30,
        occupation: 'Business',
        address: 'Address',
        employeeId: '507f1f77bcf86cd799439015'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(createCustomerService).toHaveBeenCalled();
  });

  test('Create Loan validates and calls service', async () => {
    createLoanService.mockResolvedValue({
      _id: '507f1f77bcf86cd799439013',
      loanNumber: 'LN000001',
      loanAmount: 10000
    });

    const res = await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: '507f1f77bcf86cd799439012',
        loanAmount: 10000,
        interestPercent: 7,
        durationDays: 100,
        loanDate: '2026-07-28'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(createLoanService).toHaveBeenCalled();
  });

  test('Record Collection validates and calls service', async () => {
    recordCollectionService.mockResolvedValue({
      _id: '507f1f77bcf86cd799439014',
      collectionNumber: 'COL000001',
      loanId: '507f1f77bcf86cd799439013',
      amountReceived: 500
    });

    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        loanScheduleId: '507f1f77bcf86cd799439015',
        amountReceived: 500,
        paymentMode: 'CASH'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(recordCollectionService).toHaveBeenCalled();
  });

  test('Export Report returns export response', async () => {
    getExportDataService.mockResolvedValue([{ total: 1000 }]);

    const res = await request(app)
      .get('/api/v1/reports/export/daily')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rows).toBe(1);
    expect(getExportDataService).toHaveBeenCalledWith('daily', {});
  });
});
