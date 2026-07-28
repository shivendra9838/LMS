require('dotenv').config();
const mongoose = require('mongoose');
const { getAdminDashboardStats } = require('../src/repositories/dashboard.repository');
const { getDailyReports, getEmployeeReports, getAreaReports, getOutstandingReports, getCollectionReports, getExportData } = require('../src/repositories/report.repository');
const excelExport = require('../src/utils/excelExport');
const { performance } = require('perf_hooks');
const Admin = require('../src/models/Admin');
const User = { role: 'ADMIN' };

async function runBenchmarks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for Benchmarking');

    const admin = await Admin.findOne();
    if (!admin) throw new Error('No Admin found.');
    User.id = admin._id;

    // Filters spanning a wide range to force DB scan
    const filters = { startDate: '2026-01-01', endDate: '2026-12-31' };

    console.log('\n--- Benchmarking Starting ---');

    // 1. Dashboard (< 2s)
    let start = performance.now();
    await getAdminDashboardStats();
    let end = performance.now();
    let dashboardTime = (end - start).toFixed(2);
    console.log(`[Dashboard] Time: ${dashboardTime}ms ${dashboardTime > 2000 ? '❌ FAILED' : '✅ PASSED'} SLA`);

    // 2. Reports (< 5s)
    start = performance.now();
    await getDailyReports(filters);
    end = performance.now();
    let dailyTime = (end - start).toFixed(2);
    console.log(`[Daily Report] Time: ${dailyTime}ms ${dailyTime > 5000 ? '❌ FAILED' : '✅ PASSED'} SLA`);

    start = performance.now();
    await getEmployeeReports(filters);
    end = performance.now();
    let empTime = (end - start).toFixed(2);
    console.log(`[Employee Report] Time: ${empTime}ms ${empTime > 5000 ? '❌ FAILED' : '✅ PASSED'} SLA`);

    start = performance.now();
    await getAreaReports(filters);
    end = performance.now();
    let areaTime = (end - start).toFixed(2);
    console.log(`[Area Report] Time: ${areaTime}ms ${areaTime > 5000 ? '❌ FAILED' : '✅ PASSED'} SLA`);

    start = performance.now();
    await getOutstandingReports(filters);
    end = performance.now();
    let outTime = (end - start).toFixed(2);
    console.log(`[Outstanding Report] Time: ${outTime}ms ${outTime > 5000 ? '❌ FAILED' : '✅ PASSED'} SLA`);

    start = performance.now();
    await getCollectionReports(filters);
    end = performance.now();
    let collTime = (end - start).toFixed(2);
    console.log(`[Collection Report] Time: ${collTime}ms ${collTime > 5000 ? '❌ FAILED' : '✅ PASSED'} SLA`);

    // 3. Excel Export (< 15s)
    start = performance.now();
    const data = await getExportData('daily', filters);
    const { Writable } = require('stream');
    const mockRes = new Writable({
      write(chunk, encoding, callback) {
        callback();
      }
    });
    mockRes.setHeader = () => {};
    mockRes.end = () => {};
    
    await excelExport.exportToExcel(mockRes, data, 'Daily Report', 'daily-report');
    end = performance.now();
    let excelTime = (end - start).toFixed(2);
    console.log(`[Excel Export] Time: ${excelTime}ms ${excelTime > 15000 ? '❌ FAILED' : '✅ PASSED'} SLA`);

  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runBenchmarks();
