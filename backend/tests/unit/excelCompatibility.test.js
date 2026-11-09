const ExcelJS = require('exceljs');

describe('ExcelJS UUID override compatibility', () => {
  test('writes and reads reports including extended conditional formatting', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Verification');
    sheet.columns = [{ header: 'Label', key: 'label', width: 24 }, { header: 'Amount', key: 'amount', width: 16 }];
    sheet.addRows([{ label: 'Synthetic collection', amount: 125.5 }, { label: 'Synthetic balance', amount: 250 }]);
    // The extended data-bar writer exercises ExcelJS's UUID v4 dependency.
    sheet.addConditionalFormatting({ ref: 'B2:B3', rules: [{ type: 'dataBar', minLength: 0, maxLength: 100, gradient: false, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF3366CC' } }] });
    const bytes = await workbook.xlsx.writeBuffer();
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(bytes);
    expect(restored.getWorksheet('Verification').getCell('B2').value).toBe(125.5);
    expect(restored.getWorksheet('Verification').getCell('A3').value).toBe('Synthetic balance');
    expect(restored.getWorksheet('Verification').conditionalFormattings[0].rules[0].type).toBe('dataBar');
  });
});
