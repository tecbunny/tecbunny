const fs = require('fs');

const fileContent = fs.readFileSync('c:\\Users\\tecbu\\OneDrive\\Desktop\\Project\\tecbunny\\products_export.csv', 'utf8');
const lines = fileContent.split('\n');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const headers = parseCSVLine(lines[0]);
console.log('Headers:', headers);

// Let's count columns and check if any column has prices or numbers in all rows
const colStats = headers.map(h => ({ name: h, numbers: 0 }));
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const vals = parseCSVLine(lines[i]);
  vals.forEach((val, idx) => {
    if (colStats[idx] && /^\d+(\.\d+)?$/.test(val)) {
      colStats[idx].numbers++;
    }
  });
}
console.log('Column number stats:', colStats);
