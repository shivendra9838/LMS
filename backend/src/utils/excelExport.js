// utils/excelExport.js
const ExcelJS = require('exceljs');

const exportToExcel = async (res, data, sheetName, filename) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  if (data.length > 0) {
    // Generate headers from the first object's keys
    const headers = Object.keys(data[0]).map(key => ({
      header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      key: key,
      width: 20
    }));
    sheet.columns = headers;
    
    // Format rows
    const formattedData = data.map(row => {
      const newRow = {};
      for (const key in row) {
        if (row[key] instanceof Date) {
          newRow[key] = row[key].toISOString().split('T')[0]; // Format Date as YYYY-MM-DD
        } else if (typeof row[key] === 'number') {
          newRow[key] = Math.round(row[key] * 100) / 100; // Round to 2 decimal places consistently
        } else {
          newRow[key] = row[key];
        }
      }
      return newRow;
    });
    
    sheet.addRows(formattedData);
  } else {
    sheet.columns = [{ header: 'No Data', key: 'no_data', width: 20 }];
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
  
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = {
  exportToExcel
};
