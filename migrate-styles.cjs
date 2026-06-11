const fs = require('fs');
const path = require('path');

let extractedCSS = '\n/* Extracted from Styled JSX Components */\n';
let count = 0;

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        processDir(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const regex = /<style jsx global>\s*\{`([\s\S]*?)`\}\s*<\/style>/g;
      
      let match;
      let hasChanges = false;
      while ((match = regex.exec(content)) !== null) {
        extractedCSS += match[1] + '\n';
        hasChanges = true;
        count++;
      }
      
      if (hasChanges) {
        content = content.replace(/<style jsx global>\s*\{`[\s\S]*?`\}\s*<\/style>/g, '');
        fs.writeFileSync(fullPath, content);
        console.log('Removed styled jsx from ' + fullPath);
      }
    }
  }
}

processDir('src');

if (count > 0) {
  fs.appendFileSync('src/app/globals.css', extractedCSS);
  console.log(`Extracted ${count} style blocks and appended to src/app/globals.css`);
} else {
  console.log('No styled jsx blocks found.');
}
