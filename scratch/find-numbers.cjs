const fs = require('fs');

const fileContent = fs.readFileSync('c:\\Users\\tecbu\\OneDrive\\Desktop\\Project\\tecbunny\\products_export.csv', 'utf8');
const lines = fileContent.split('\n');

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  // Match any numbers in the line that might represent a price
  const matches = lines[i].match(/\b\d{3,5}\b/g);
  if (matches) {
    console.log(`Line ${i}:`, matches, lines[i].slice(0, 100));
  }
}
