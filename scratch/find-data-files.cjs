const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === '.next' || file === '.git') return;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      if (file.endsWith('.json') || file.endsWith('.csv') || file.endsWith('.sql')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const allFiles = walk('c:\\Users\\tecbu\\OneDrive\\Desktop\\Project\\tecbunny');
console.log('JSON/CSV/SQL files:', allFiles);
