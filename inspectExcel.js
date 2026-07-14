const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'Price List Product UKM Kemasan Juli.xlsx');

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Parse to JSON
  const data = xlsx.utils.sheet_to_json(sheet, { defval: null });
  
  console.log(`Sheet Name: ${sheetName}`);
  console.log(`Total Rows: ${data.length}`);
  console.log('First 3 Rows Structure:');
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
} catch (error) {
  console.error("Error reading Excel:", error);
}
